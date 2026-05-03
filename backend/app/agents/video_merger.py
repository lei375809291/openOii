from __future__ import annotations

from typing import cast

from sqlalchemy import select
from sqlalchemy.orm import InstrumentedAttribute

from app.agents.base import AgentContext, BaseAgent
from app.models.project import Shot
from app.services.creative_control import collect_project_blocking_clips


class VideoMergerAgent(BaseAgent):
    """拼接所有分镜视频为完整视频"""

    name = "video_merger"

    async def run(self, ctx: AgentContext) -> None:
        project_id = ctx.project.id
        if project_id is None:
            raise RuntimeError("Project must be persisted before final assembly")

        # 只有全量重跑才允许沿用已有成片直接短路；显式增量 retry merge 需要继续执行
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
                ctx,
                "当前仍有分镜视频未满足最终拼接条件，请先完成这些分镜后再试。",
                progress=1.0,
                is_loading=False,
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

        # 获取所有带视频的 Shot，按场景和镜头顺序排序
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
            await self.send_message(ctx, "没有可拼接的分镜视频，请先生成各分镜视频。")
            return

        # 收集视频 URL
        video_urls = [shot.video_url for shot in shots if shot.video_url]

        if not video_urls:
            await self.send_message(ctx, "没有有效的视频 URL 可拼接。")
            return

        try:
            # 发送开始消息
            await self.send_message(
                ctx, f"🎞️ 开始拼接 {len(video_urls)} 个分镜视频...", progress=0.0, is_loading=True
            )

            # 调用视频服务拼接
            merged_url = await ctx.video.merge_urls(video_urls)

            # 更新项目
            ctx.project.video_url = merged_url
            ctx.project.status = "ready"
            ctx.session.add(ctx.project)
            await ctx.session.commit()
            await ctx.session.refresh(ctx.project)

            # 发送 project_updated 事件，通知前端刷新
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

            # 发送完成消息
            summary = f"将{len(video_urls)}个分镜拼接为完整视频"
            await self.send_message(
                ctx,
                f"🎉 漫剧制作完成！已将 {len(video_urls)} 个分镜拼接为完整视频。",
                summary=summary,
                progress=1.0,
                is_loading=False,
            )
        except Exception as e:
            # 合并失败不影响整体流程
            await self.send_message(
                ctx, f"视频拼接失败: {e}。您可以稍后手动拼接。", progress=1.0, is_loading=False
            )
