from __future__ import annotations

from sqlalchemy import select

from app.agents.base import AgentContext, BaseAgent
from app.agents.utils import build_character_context
from app.models.project import Character, Shot
from app.services.doubao_video import DoubaoVideoService
from app.services.image_composer import ImageComposer
from app.services.shot_binding import resolve_shot_bound_approved_characters


class VideoGeneratorAgent(BaseAgent):
    """为分镜生成视频"""

    name = "video_generator"

    def __init__(self):
        super().__init__()
        self.image_composer = ImageComposer()

    def _build_video_prompt(self, shot: Shot, characters: list[Character], *, style: str) -> str:
        """构建视频生成 prompt"""
        # 优先使用 prompt（由 Scriptwriter 生成的 video_prompt）
        desc = shot.prompt or shot.description
        parts = [desc.strip()]

        # 使用工具函数构建角色上下文
        char_context = build_character_context(characters)
        if char_context:
            parts.append(char_context)

        if style.strip():
            parts.append(f"Style: {style.strip()}")

        return ", ".join(parts)

    def _get_duration(self, shot: Shot, default_duration: float) -> float:
        """获取视频时长（秒）"""
        if shot.duration and shot.duration > 0:
            return shot.duration
        return default_duration

    async def run(self, ctx: AgentContext) -> None:
        # 查找没有视频的 Shot（可按目标分镜过滤）
        query = select(Shot).where(
            Shot.project_id == ctx.project.id,
            Shot.video_url.is_(None),
        )
        if ctx.target_ids and ctx.target_ids.shot_ids:
            query = query.where(Shot.id.in_(ctx.target_ids.shot_ids))
        res = await ctx.session.execute(query)
        shots = res.scalars().all()
        if not shots:
            await self.send_message(ctx, "所有分镜已有视频。")
            return

        # 检查是否使用图生视频模式
        use_image_mode = ctx.settings.use_i2v()
        # 检查是否使用豆包服务
        is_doubao = isinstance(ctx.video, DoubaoVideoService)
        default_duration = float(ctx.settings.doubao_video_duration) if is_doubao else 5.0

        total = len(shots)
        updated_count = 0

        mode_desc = "图生视频" if use_image_mode else "文生视频"
        image_mode = (ctx.settings.video_image_mode or "first_frame").strip().lower()
        # 发送带进度的消息
        await self.send_message(
            ctx,
            f"🎬 开始为 {total} 个分镜生成视频（{mode_desc}）...",
            progress=0.0,
            is_loading=True,
        )

        for i, shot in enumerate(shots):
            try:
                # 使用基类方法发送进度消息
                await self.send_progress_batch(
                    ctx,
                    total=total,
                    current=i,
                    message=f"   正在生成视频 {i + 1}/{total}...",
                )

                characters = await resolve_shot_bound_approved_characters(ctx.session, shot)
                video_prompt = self._build_video_prompt(shot, characters, style=ctx.project.style)
                duration = self._get_duration(shot, default_duration)

                # 根据服务类型选择不同的调用方式
                if is_doubao:
                    # 豆包服务：使用图片 URL
                    image_url: str | None = None
                    if use_image_mode and shot.image_url:
                        if image_mode == "reference":
                            try:
                                char_image_urls = [c.image_url for c in characters if c.image_url]

                                # 拼接分镜图和角色图，保存到本地并获取 URL
                                image_url = (
                                    await self.image_composer.compose_and_save_reference_image(
                                        shot_image_url=shot.image_url,
                                        character_image_urls=char_image_urls,
                                    )
                                )
                                await self.send_message(
                                    ctx,
                                    f"镜头 {shot.order}: 已生成参考图（分镜图 + {len(char_image_urls)} 个角色图）",
                                )
                            except Exception as e:
                                await self.send_message(
                                    ctx,
                                    f"镜头 {shot.order}: 参考图生成失败，将使用分镜首帧图: {e}",
                                )
                                image_url = shot.image_url
                        else:
                            image_url = shot.image_url

                    # 豆包服务的 generate_url 接口
                    video_url = await ctx.video.generate_url(
                        prompt=video_prompt,
                        image_url=image_url,
                        duration=int(duration) if duration in (5, 10) else 5,
                        ratio=ctx.settings.doubao_video_ratio,
                        generate_audio=ctx.settings.doubao_generate_audio,
                    )
                else:
                    # OpenAI 兼容服务：使用图片字节流
                    reference_image_bytes: bytes | None = None
                    if use_image_mode and shot.image_url:
                        try:
                            if image_mode == "reference":
                                char_image_urls = [c.image_url for c in characters if c.image_url]

                                # 拼接分镜图和角色图
                                reference_image_bytes = (
                                    await self.image_composer.compose_reference_image(
                                        shot_image_url=shot.image_url,
                                        character_image_urls=char_image_urls,
                                    )
                                )
                                await self.send_message(
                                    ctx,
                                    f"镜头 {shot.order}: 已生成参考图（分镜图 + {len(char_image_urls)} 个角色图）",
                                )
                            else:
                                # 仅使用分镜首帧图
                                reference_image_bytes = (
                                    await self.image_composer.compose_reference_image(
                                        shot_image_url=shot.image_url,
                                        character_image_urls=[],
                                    )
                                )
                        except Exception as e:
                            await self.send_message(
                                ctx, f"镜头 {shot.order}: 参考图生成失败，将使用文生视频模式: {e}"
                            )
                            reference_image_bytes = None

                    # OpenAI 兼容服务的 generate_url 接口
                    video_url = await ctx.video.generate_url(
                        prompt=video_prompt,
                        image_bytes=reference_image_bytes,
                    )

                shot.video_url = video_url
                shot.duration = duration  # 确保时长被记录
                ctx.session.add(shot)
                await ctx.session.flush()  # 确保更新生效
                # 发送分镜更新事件
                await self.send_shot_event(ctx, shot, "shot_updated")
                updated_count += 1
            except Exception as e:
                await self.send_message(ctx, f"镜头 {shot.order} 视频生成失败: {e}")

        await ctx.session.commit()
        # 完成消息
        if updated_count > 0:
            await self.send_message(
                ctx,
                f"✅ 已为 {updated_count} 个分镜生成视频，接下来将合成完整视频。",
                progress=1.0,
                is_loading=False,
            )
        else:
            await self.send_message(
                ctx, "❌ 所有分镜视频生成均失败。", progress=1.0, is_loading=False
            )
