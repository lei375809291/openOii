from __future__ import annotations

import json

from app.agents.base import AgentContext, BaseAgent
from app.agents.prompts.director import SYSTEM_PROMPT
from app.agents.utils import extract_json
from app.db.utils import utcnow


class DirectorAgent(BaseAgent):
    name = "director"

    async def run(self, ctx: AgentContext) -> None:
        # 发送开始消息
        await self.send_message(ctx, "🎬 正在进行导演规划...", progress=0.0, is_loading=True)

        user_prompt = json.dumps(
            {
                "project": {
                    "id": ctx.project.id,
                    "title": ctx.project.title,
                    "story": ctx.project.story,
                    "style": ctx.project.style,
                    "status": ctx.project.status,
                }
            },
            ensure_ascii=False,
        )

        resp = await self.call_llm(ctx, system_prompt=SYSTEM_PROMPT, user_prompt=user_prompt, max_tokens=4096)
        data = extract_json(resp.text)

        # 提取导演规划信息
        lines = []

        # 视觉风格
        project_update = data.get("project_update") or {}
        if isinstance(project_update, dict):
            style = project_update.get("style")
            status = project_update.get("status")
            if isinstance(style, str) and style.strip():
                ctx.project.style = style.strip()
                lines.append(f"🎨 视觉风格：{ctx.project.style}")
            if isinstance(status, str) and status.strip():
                ctx.project.status = status.strip()

        # 导演笔记
        director_notes = data.get("director_notes") or {}
        if isinstance(director_notes, dict):
            vision = director_notes.get("vision")
            if vision:
                lines.append(f"🎯 创作愿景：{vision}")

            pacing = director_notes.get("pacing")
            if pacing:
                lines.append(f"⏱️ 节奏把控：{pacing}")

            mood = director_notes.get("mood")
            if mood:
                lines.append(f"🌙 情绪基调：{mood}")

        # 剧情大纲 - 显示故事段落
        scene_outline = data.get("scene_outline") or []
        if isinstance(scene_outline, list) and scene_outline:
            lines.append(f"📋 剧情大纲：共 {len(scene_outline)} 个段落")
            for i, scene in enumerate(scene_outline):
                if isinstance(scene, dict):
                    title = scene.get("title") or scene.get("description", "")[:30]
                    if title:
                        lines.append(f"   {i+1}. {title}")

        # 生成摘要
        summary_parts = []
        if ctx.project.style:
            summary_parts.append(f"视觉风格：{ctx.project.style}")
        vision = (data.get("director_notes") or {}).get("vision")
        if vision:
            summary_parts.append(f"创作愿景：{vision}")
        scene_count = len(data.get("scene_outline") or [])
        if scene_count:
            summary_parts.append(f"剧情大纲：{scene_count}个段落")

        summary = "，".join(summary_parts) if summary_parts else "导演规划完成"

        # 写入项目摘要（画布编剧卡片读取此字段）
        ctx.project.summary = summary

        # 发送规划结果
        if lines:
            await self.send_message(ctx, "\n".join(lines), summary=summary)

        ctx.project.updated_at = utcnow()
        ctx.session.add(ctx.project)
        await ctx.session.commit()

        await self.send_message(ctx, "✅ 导演规划完成，接下来将由编剧创作详细剧本。", progress=1.0)
