from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.agents.base import AgentContext, BaseAgent, CompletionInfo
from app.agents.utils import build_character_context
from app.models.project import Character, Shot
from app.services.image_composer import ImageComposer
from app.services.shot_binding import resolve_shot_bound_approved_characters

logger = logging.getLogger(__name__)


class RenderAgent(BaseAgent):
    name = "render"

    def __init__(self):
        super().__init__()
        self.image_composer = ImageComposer()

    def _style_descriptor(self, style: str) -> str:
        mapping = {
            "anime": "anime, 2D illustration, cel-shading, vibrant colors, Japanese animation style",
            "shonen": "anime, shonen style, high contrast, dynamic composition, dramatic lighting, bold lines",
            "slice-of-life": "anime, slice of life, soft pastel colors, warm lighting, rounded lines, cozy atmosphere",
            "manga": "manga style, black and white, halftone dots, speed lines, high contrast ink",
            "donghua": "Chinese animation, ink wash, flowing lines, oriental color palette, watercolor textures",
            "cinematic": "cinematic, photorealistic, 35mm film grain, natural lighting, shallow depth of field",
            "pixar": "3D cartoon, Pixar-style rendering, smooth surfaces, global illumination, rounded shapes",
            "lowpoly": "low poly, geometric, faceted surfaces, hard edge lighting, minimalist palette",
            "watercolor": "watercolor, soft bleeding edges, transparent layering, white space breathing, painterly",
            "sketch": "pencil sketch, cross-hatching, monochrome shading, rough lines, hand-drawn",
            "realistic": "photorealistic, natural lighting, detailed textures, real-world proportions",
        }
        return mapping.get(style, mapping.get("anime"))

    def _build_character_prompt(self, character: Character, *, style: str) -> str:
        desc = character.description or character.name
        style_desc = self._style_descriptor(style)
        # 面部锚定词：强调清晰五官，提升一致性
        face_anchor = "detailed face, clear facial features, sharp eyes"
        return f"{desc}, {face_anchor}, {style_desc}"

    def _build_shot_prompt(self, shot: Shot, characters: list[Character], *, style: str) -> str:
        desc = shot.image_prompt or shot.description
        parts = [desc.strip()]
        char_context = build_character_context(characters)
        if char_context:
            parts.append(char_context)
        # 面部一致性锚定词
        if characters:
            parts.append("same character face as reference, consistent identity")
        style_desc = self._style_descriptor(style)
        parts.append(style_desc)
        return ", ".join(parts)

    async def _render_characters(self, ctx: AgentContext) -> int:
        query = select(Character).where(
            Character.project_id == ctx.project.id,
            Character.image_url.is_(None),
        )
        if ctx.target_ids and ctx.target_ids.character_ids:
            query = query.where(Character.id.in_(ctx.target_ids.character_ids))
        res = await ctx.session.execute(query)
        characters = res.scalars().all()

        if not characters:
            await self.send_message(ctx, "所有角色已有形象图。")
            return 0

        total = len(characters)
        await self.send_message(
            ctx, f"开始为 {total} 个角色生成形象图...", progress=0.0, is_loading=True
        )

        updated_count = 0
        style = ctx.project.style or ""
        for i, char in enumerate(characters):
            try:
                await self.send_progress_batch(
                    ctx,
                    total=total,
                    current=i,
                    message=f"   正在绘制：{char.name} ({i + 1}/{total})",
                )
                image_prompt = self._build_character_prompt(char, style=style)
                external_url = await self.generate_and_cache_image(ctx, prompt=image_prompt)
                char.image_url = external_url
                ctx.session.add(char)
                await ctx.session.flush()
                await self.send_character_event(ctx, char, "character_updated")
                updated_count += 1
            except Exception as e:
                await self.send_message(ctx, f"角色 {char.name} 图片生成失败: {str(e)[:50]}")

        await ctx.session.commit()
        if updated_count > 0:
            char_names_list = [c.name for c in characters[:updated_count]]
            names_str = "、".join(char_names_list) if char_names_list else f"{updated_count} 个角色"
            await self.send_message(ctx, f"已为 {names_str} 生成形象图，接下来生成分镜图。")
        return updated_count

    async def _render_shots(self, ctx: AgentContext) -> int:
        query = (
            select(Shot)
            .where(
                Shot.project_id == ctx.project.id,
                Shot.image_url.is_(None),
            )
            .order_by(Shot.order)
        )
        if ctx.target_ids and ctx.target_ids.shot_ids:
            query = query.where(Shot.id.in_(ctx.target_ids.shot_ids))
        res = await ctx.session.execute(query)
        shots = res.scalars().all()

        if not shots:
            await self.send_message(ctx, "所有分镜已有首帧图片。")
            return 0

        total = len(shots)
        updated_count = 0
        failed_count = 0
        style = ctx.project.style or ""

        await self.send_message(
            ctx,
            f"开始为 {total} 个分镜生成首帧图片（使用角色参考图）...",
            progress=0.0,
            is_loading=True,
        )

        for i, shot in enumerate(shots):
            try:
                await self.send_progress_batch(
                    ctx, total=total, current=i, message=f"   正在绘制分镜 {i + 1}/{total}..."
                )

                characters = await resolve_shot_bound_approved_characters(ctx.session, shot)
                char_image_urls = [c.image_url for c in characters if c.image_url]
                reference_image_bytes: bytes | None = None

                if char_image_urls:
                    try:
                        reference_image_bytes = (
                            await self.image_composer.compose_character_reference_image(
                                char_image_urls
                            )
                        )
                        logger.info(
                            "Composed character reference image with %d characters for shot %d",
                            len(char_image_urls),
                            shot.id,
                        )
                    except Exception as exc:
                        reference_image_bytes = None
                        logger.warning("Failed to compose character reference image: %s", exc)
                else:
                    logger.info(
                        "No character images available for shot %d; using text-to-image", shot.id
                    )

                image_prompt = self._build_shot_prompt(shot, characters, style=style)

                image_url = await self.generate_and_cache_image(
                    ctx,
                    prompt=image_prompt,
                    image_bytes=reference_image_bytes,
                    timeout_s=480.0,
                )

                shot.image_url = image_url
                ctx.session.add(shot)
                await ctx.session.flush()
                await self.send_shot_event(ctx, shot, "shot_updated")
                updated_count += 1

                if i < total - 1:
                    await asyncio.sleep(1.0)

            except Exception as e:
                failed_count += 1
                await self.send_message(ctx, f"镜头 {shot.order} 首帧图片生成失败: {str(e)[:100]}")
                await asyncio.sleep(2.0)

        await ctx.session.commit()

        summary = (
            f"为{updated_count}个分镜生成了首帧图片" if updated_count > 0 else "分镜图片生成失败"
        )
        if updated_count > 0:
            shots[0].description[:20] if shots and shots[0].description else ""
            msg = f"已为 {updated_count} 个分镜生成首帧图片，接下来将生成视频。"
            if failed_count > 0:
                msg += f"（{failed_count} 个失败）"
            await self.send_message(ctx, msg, summary=summary, progress=1.0)
        elif failed_count > 0:
            await self.send_message(
                ctx,
                f"所有 {failed_count} 个分镜首帧图片生成均失败。",
                summary=summary,
                progress=1.0,
            )

        return updated_count

    async def run_characters(self, ctx: AgentContext) -> None:
        """Render character images only (sub-step 1)."""
        await self.send_message(ctx, "开始生成角色形象图...", progress=0.0, is_loading=True)
        char_count = await self._render_characters(ctx)
        ctx.completion_info = CompletionInfo(
            completed=f"已生成 {char_count} 个角色形象图",
            details="角色形象已渲染完成",
            next="接下来渲染分镜画面",
            question="角色形象是否满意？如果需要重新生成，请告诉我。",
        )
        await self.send_message(
            ctx,
            f"角色形象渲染完成！已生成 {char_count} 个角色形象图。",
            summary=f"{char_count} 个角色形象图",
            progress=1.0,
        )

    async def run_shots(self, ctx: AgentContext) -> None:
        """Render shot storyboard images only (sub-step 2)."""
        await self.send_message(ctx, "开始生成分镜首帧图...", progress=0.0, is_loading=True)
        shot_count = await self._render_shots(ctx)
        ctx.completion_info = CompletionInfo(
            completed=f"已生成 {shot_count} 个分镜首帧图",
            details="分镜画面已渲染完成",
            next="接下来将根据分镜生成视频片段并合成",
            question="分镜画面是否满意？如果需要重新生成，请告诉我。",
        )
        await self.send_message(
            ctx,
            f"分镜画面渲染完成！已生成 {shot_count} 个分镜首帧图。",
            summary=f"{shot_count} 个分镜首帧图",
            progress=1.0,
        )

    async def run(self, ctx: AgentContext) -> None:
        """Legacy entry point — runs both sub-steps sequentially."""
        await self.send_message(
            ctx,
            "开始渲染：先生成角色形象图，再使用角色图作为参考生成分镜图...",
            progress=0.0,
            is_loading=True,
        )
        await self.run_characters(ctx)
        await self.run_shots(ctx)
