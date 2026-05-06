from __future__ import annotations

import logging

from sqlalchemy import select

from app.agents.base import AgentContext, BaseAgent, CompletionInfo
from app.models.project import Character
from app.services.image_composer import ImageComposer

logger = logging.getLogger(__name__)


class CharacterAgent(BaseAgent):
    name = "character"

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
        return f"{desc}, {style_desc}"

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
        await self.send_message(ctx, f"开始为 {total} 个角色生成形象图...", progress=0.0, is_loading=True)

        updated_count = 0
        style = ctx.project.style or ""
        for i, char in enumerate(characters):
            try:
                await self.send_progress_batch(ctx, total=total, current=i, message=f"   正在绘制：{char.name} ({i+1}/{total})")
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
            await self.send_message(ctx, f"已为 {names_str} 生成形象图。")
        return updated_count

    async def run(self, ctx: AgentContext) -> None:
        await self.send_message(ctx, "开始生成角色形象图...", progress=0.0, is_loading=True)

        char_count = await self._render_characters(ctx)

        ctx.completion_info = CompletionInfo(
            completed=f"已生成 {char_count} 个角色形象图",
            details="角色形象图已全部渲染完成",
            next="接下来将使用角色图作为参考生成分镜首帧图",
            question="角色形象是否满意？如需重新生成，请告诉我。",
        )
        await self.send_message(ctx, "角色形象图生成完成！", summary=f"角色形象图生成完成：{char_count}个", progress=1.0)
