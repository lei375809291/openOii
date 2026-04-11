from __future__ import annotations

import asyncio
import logging

from sqlalchemy import select

from app.agents.base import AgentContext, BaseAgent
from app.agents.utils import build_character_context
from app.models.project import Character, Shot
from app.services.shot_binding import resolve_shot_bound_approved_characters
from app.services.image_composer import ImageComposer

logger = logging.getLogger(__name__)


class StoryboardArtistAgent(BaseAgent):
    """为分镜生成首帧图片"""

    name = "storyboard_artist"

    def __init__(self):
        super().__init__()
        self.image_composer = ImageComposer()

    def _build_image_prompt(self, shot: Shot, characters: list[Character], *, style: str) -> str:
        """构建首帧图片生成 prompt"""
        # 优先使用 image_prompt，否则使用 description
        desc = shot.image_prompt or shot.description
        parts = [desc.strip()]

        # 使用工具函数构建角色上下文
        char_context = build_character_context(characters)
        if char_context:
            parts.append(char_context)

        # 强制动漫风格：添加更具体的风格关键词
        anime_style = (
            "anime, 2D illustration, cel-shading, vibrant colors, Japanese animation style"
        )
        parts.append(anime_style)
        if style.strip():
            parts.append(style.strip())

        return ", ".join(parts)

    async def run(self, ctx: AgentContext) -> None:
        use_i2i = ctx.settings.use_i2i()

        # 查找没有首帧图片的 Shot（可按目标分镜过滤）
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
            return

        total = len(shots)
        updated_count = 0
        failed_count = 0

        # 发送带进度的消息
        await self.send_message(
            ctx, f"🖼️ 开始为 {total} 个分镜生成首帧图片...", progress=0.0, is_loading=True
        )

        for i, shot in enumerate(shots):
            try:
                # 使用基类方法发送进度消息
                await self.send_progress_batch(
                    ctx,
                    total=total,
                    current=i,
                    message=f"   正在绘制分镜 {i + 1}/{total}...",
                )

                characters = await resolve_shot_bound_approved_characters(ctx.session, shot)
                char_image_urls = [c.image_url for c in characters if c.image_url]
                reference_image_bytes: bytes | None = None

                if use_i2i:
                    if not char_image_urls:
                        logger.info(
                            "I2I enabled but no character images available; will fall back to text-to-image"
                        )
                    else:
                        try:
                            reference_image_bytes = (
                                await self.image_composer.compose_character_reference_image(
                                    char_image_urls
                                )
                            )
                            logger.info(
                                "I2I enabled: composed character reference image with %d characters",
                                len(char_image_urls),
                            )
                        except Exception as exc:
                            reference_image_bytes = None
                            logger.warning(
                                "Failed to compose character reference image; falling back to text-to-image: %s",
                                exc,
                                exc_info=True,
                            )

                image_prompt = self._build_image_prompt(shot, characters, style=ctx.project.style)

                # 仅对 URL 生成阶段加超时（8分钟），缓存/下载不受此超时影响
                image_url = await self.generate_and_cache_image(
                    ctx,
                    prompt=image_prompt,
                    image_bytes=reference_image_bytes if use_i2i else None,
                    timeout_s=480.0,
                )

                shot.image_url = image_url
                ctx.session.add(shot)
                await ctx.session.flush()  # 确保更新生效
                # 发送分镜更新事件
                await self.send_shot_event(ctx, shot, "shot_updated")
                updated_count += 1

                # 添加延迟避免 API 限流（每张图片后等待 1 秒）
                if i < total - 1:
                    await asyncio.sleep(1.0)

            except Exception as e:
                failed_count += 1
                error_msg = f"⚠️ 镜头 {shot.order} 首帧图片生成失败: {str(e)[:100]}"
                await self.send_message(ctx, error_msg)
                # 失败后等待更长时间再继续
                await asyncio.sleep(2.0)

        await ctx.session.commit()

        # 完成消息
        if updated_count > 0:
            msg = f"✅ 已为 {updated_count} 个分镜生成首帧图片，接下来将生成视频。"
            if failed_count > 0:
                msg += f"（{failed_count} 个失败）"
            await self.send_message(ctx, msg, progress=1.0, is_loading=False)
        elif failed_count > 0:
            await self.send_message(
                ctx,
                f"❌ 所有 {failed_count} 个分镜首帧图片生成均失败。",
                progress=1.0,
                is_loading=False,
            )
