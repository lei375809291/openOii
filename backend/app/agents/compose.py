from __future__ import annotations

from typing import cast

from sqlalchemy import select
from sqlalchemy.orm import InstrumentedAttribute

from app.agents.base import AgentContext, BaseAgent, CompletionInfo
from app.agents.utils import build_character_context
from app.models.project import Character, Shot
from app.orchestration.state import workflow_progress_for_stage
from app.services.creative_control import collect_project_blocking_clips
from app.services.doubao_video import DoubaoVideoService
from app.services.image_composer import ImageComposer
from app.services.shot_binding import resolve_shot_bound_approved_characters


class ComposeAgent(BaseAgent):
    name = "compose"

    def __init__(self):
        super().__init__()
        self.image_composer = ImageComposer()

    def _build_video_prompt(self, shot: Shot, characters: list[Character], *, style: str) -> str:
        desc = shot.prompt or shot.description
        parts = [desc.strip()]
        char_context = build_character_context(characters)
        if char_context:
            parts.append(char_context)
        if style.strip():
            parts.append(f"Style: {style.strip()}")
        return ", ".join(parts)

    def _get_duration(self, shot: Shot, default_duration: float) -> float:
        if shot.duration and shot.duration > 0:
            return shot.duration
        return default_duration

    async def _generate_videos(self, ctx: AgentContext) -> int:
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
            return 0

        use_image_mode = ctx.settings.use_i2v()
        is_doubao = isinstance(ctx.video, DoubaoVideoService)
        default_duration = float(ctx.settings.doubao_video_duration) if is_doubao else 5.0
        image_mode = (ctx.settings.video_image_mode or "first_frame").strip().lower()

        total = len(shots)
        updated_count = 0
        mode_desc = "图生视频" if use_image_mode else "文生视频"
        await self.send_message(
            ctx, f"开始为 {total} 个分镜生成视频（{mode_desc}）...", progress=0.0, is_loading=True
        )

        for i, shot in enumerate(shots):
            try:
                shot_progress = i / max(total, 1)
                await self.send_progress_batch(
                    ctx, total=total, current=i, message=f"   正在生成视频 {i + 1}/{total}..."
                )
                await ctx.ws.send_event(
                    ctx.project.id,
                    {
                        "type": "run_progress",
                        "data": {
                            "run_id": ctx.run.id,
                            "current_agent": "compose",
                            "current_stage": "compose",
                            "stage": "compose",
                            "next_stage": None,
                            "progress": workflow_progress_for_stage(
                                "compose", within_stage=shot_progress
                            ),
                        },
                    },
                )
                characters = await resolve_shot_bound_approved_characters(ctx.session, shot)
                video_prompt = self._build_video_prompt(shot, characters, style=ctx.project.style)
                duration = self._get_duration(shot, default_duration)

                if is_doubao:
                    image_url: str | None = None
                    if use_image_mode and shot.image_url:
                        if image_mode == "reference":
                            try:
                                char_image_urls = [c.image_url for c in characters if c.image_url]
                                image_url = (
                                    await self.image_composer.compose_and_save_reference_image(
                                        shot_image_url=shot.image_url,
                                        character_image_urls=char_image_urls,
                                    )
                                )
                            except Exception:
                                image_url = shot.image_url
                        else:
                            image_url = shot.image_url

                    video_url = await ctx.video.generate_url(
                        prompt=video_prompt,
                        image_url=image_url,
                        duration=int(duration) if duration in (5, 10) else 5,
                        ratio=ctx.settings.doubao_video_ratio,
                        generate_audio=ctx.settings.doubao_generate_audio,
                    )
                else:
                    reference_image_bytes: bytes | None = None
                    if use_image_mode and shot.image_url:
                        try:
                            if image_mode == "reference":
                                char_image_urls = [c.image_url for c in characters if c.image_url]
                                reference_image_bytes = (
                                    await self.image_composer.compose_reference_image(
                                        shot_image_url=shot.image_url,
                                        character_image_urls=char_image_urls,
                                    )
                                )
                            else:
                                reference_image_bytes = (
                                    await self.image_composer.compose_reference_image(
                                        shot_image_url=shot.image_url,
                                        character_image_urls=[],
                                    )
                                )
                        except Exception:
                            reference_image_bytes = None

                    video_url = await ctx.video.generate_url(
                        prompt=video_prompt,
                        image_bytes=reference_image_bytes,
                    )

                shot.video_url = video_url
                shot.duration = duration
                ctx.session.add(shot)
                await ctx.session.flush()
                await self.send_shot_event(ctx, shot, "shot_updated")
                updated_count += 1
            except Exception as e:
                await self.send_message(ctx, f"镜头 {shot.order} 视频生成失败: {e}")

        await ctx.session.commit()
        return updated_count

    async def _merge_videos(self, ctx: AgentContext) -> None:
        project_id = ctx.project.id
        if project_id is None:
            raise RuntimeError("Project must be persisted before final assembly")

        if (
            ctx.project.video_url
            and ctx.project.status != "superseded"
            and ctx.rerun_mode == "full"
        ):
            await self.send_message(ctx, "项目已有最终视频。")
            return

        blocking_clips = await collect_project_blocking_clips(ctx.session, ctx.project)
        if blocking_clips:
            if ctx.project.video_url:
                ctx.project.status = "superseded"
            ctx.session.add(ctx.project)
            await ctx.session.commit()
            await ctx.session.refresh(ctx.project)
            await self.send_message(
                ctx, "当前仍有分镜视频未满足拼接条件，请先完成这些分镜。", progress=1.0
            )
            await ctx.ws.send_event(
                project_id,
                {
                    "type": "project_updated",
                    "data": {
                        "project": {
                            "id": ctx.project.id,
                            "video_url": ctx.project.video_url,
                            "status": ctx.project.status,
                            "blocking_clips": blocking_clips,
                        }
                    },
                },
            )
            return

        shot_project_id_col = cast(InstrumentedAttribute[int], cast(object, Shot.project_id))
        shot_video_url_col = cast(InstrumentedAttribute[str | None], cast(object, Shot.video_url))
        shot_order_col = cast(InstrumentedAttribute[int], cast(object, Shot.order))
        res = await ctx.session.execute(
            select(Shot)
            .where(shot_project_id_col == project_id, shot_video_url_col.is_not(None))
            .order_by(shot_order_col.asc())
        )
        shots = res.scalars().all()

        if not shots:
            await self.send_message(ctx, "没有可拼接的分镜视频。")
            return

        video_urls = [shot.video_url for shot in shots if shot.video_url]
        if not video_urls:
            await self.send_message(ctx, "没有有效的视频 URL 可拼接。")
            return

        try:
            await self.send_message(
                ctx, f"开始拼接 {len(video_urls)} 个分镜视频...", progress=0.0, is_loading=True
            )
            merged_url = await ctx.video.merge_urls(video_urls)

            ctx.project.video_url = merged_url
            ctx.project.status = "ready"
            ctx.session.add(ctx.project)
            await ctx.session.commit()
            await ctx.session.refresh(ctx.project)

            await ctx.ws.send_event(
                project_id,
                {
                    "type": "project_updated",
                    "data": {
                        "project": {
                            "id": ctx.project.id,
                            "video_url": merged_url,
                            "status": ctx.project.status,
                            "blocking_clips": [],
                        }
                    },
                },
            )

            summary = f"将{len(video_urls)}个分镜拼接为完整视频"
            first_shot = shots[0] if shots else None
            shot_hint = (
                f"「{first_shot.description[:15]}…」"
                if first_shot and first_shot.description
                else ""
            )
            ctx.completion_info = CompletionInfo(
                completed=f"已将 {len(video_urls)} 个分镜拼接为完整视频",
                next="您的漫剧已经准备就绪！可以下载或分享了。",
                question="最终视频效果满意吗？",
            )
            await self.send_message(
                ctx,
                f"漫剧制作完成！{shot_hint}等 {len(video_urls)} 个分镜已拼接为完整视频。",
                summary=summary,
                progress=1.0,
            )
        except Exception as e:
            await self.send_message(ctx, f"视频拼接失败: {e}。您可以稍后手动拼接。", progress=1.0)

    async def run_videos(self, ctx: AgentContext) -> int:
        """Generate shot videos only (sub-step 1)."""
        await self.send_message(ctx, "开始生成分镜视频...", progress=0.0, is_loading=True)
        video_count = await self._generate_videos(ctx)
        if video_count > 0:
            ctx.completion_info = CompletionInfo(
                completed=f"已生成 {video_count} 个分镜视频",
                next="接下来拼接完整视频",
                question="分镜视频效果如何？",
            )
        else:
            ctx.completion_info = CompletionInfo(
                completed="无视频可生成",
                next="跳过拼接",
                question="",
            )
        return video_count

    async def run_merge(self, ctx: AgentContext) -> None:
        """Merge shot videos into final video (sub-step 2)."""
        await self._merge_videos(ctx)

    async def run(self, ctx: AgentContext) -> None:
        """Legacy entry point — runs both sub-steps sequentially."""
        await self.send_message(
            ctx, "开始合成：先生成分镜视频，再拼接完整视频...", progress=0.0, is_loading=True
        )
        video_count = await self.run_videos(ctx)
        if video_count > 0:
            await self.run_merge(ctx)
        else:
            await self.send_message(ctx, "无视频可合成。", progress=1.0)
