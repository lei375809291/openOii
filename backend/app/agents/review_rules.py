from __future__ import annotations

from typing import Any

from app.agents.base import AgentContext, BaseAgent
from app.services.creative_control import infer_feedback_targets

ALLOWED_START_AGENTS = {"plan", "render", "compose"}

_FEEDBACK_TYPE_MAP = {
    "plan": "plan",
    "story": "plan",
    "script": "plan",
    "character": "render",
    "shot": "render",
    "storyboard": "render",
    "video": "compose",
    "merge": "compose",
}

_RETRY_MERGE_KEYWORDS = (
    "retry merge",
    "重试合成",
    "重新合成",
    "重新拼接最终视频",
    "重新合并最终视频",
    "final-output",
)


def _is_retry_merge_feedback(feedback: str) -> bool:
    normalized = feedback.strip().lower()
    return any(keyword in normalized for keyword in _RETRY_MERGE_KEYWORDS)


class ReviewRuleEngine(BaseAgent):
    name = "review"

    async def run(self, ctx: AgentContext) -> Any:
        feedback = ""
        if hasattr(ctx, "user_feedback") and ctx.user_feedback:
            feedback = ctx.user_feedback.strip()

        if not feedback:
            await self.send_message(ctx, "未找到用户反馈内容，将从规划阶段重新开始。")
            return {"start_agent": "plan", "mode": "full", "reason": "未提供具体反馈"}

        retry_merge_requested = _is_retry_merge_feedback(feedback)

        feedback_type = ctx.feedback_type or "plan"
        start_agent = _FEEDBACK_TYPE_MAP.get(feedback_type, "plan")

        mode = "incremental"
        if feedback_type in ("plan", "story", "script"):
            mode = "incremental"
        elif feedback_type in ("render", "shot"):
            mode = "incremental"
        else:
            mode = "incremental"

        target_ids = infer_feedback_targets(
            {"routing": {"start_agent": start_agent, "mode": mode}},
            {"project_id": ctx.project.id},
        )

        if retry_merge_requested:
            start_agent = "compose"
            mode = "incremental"

        if start_agent not in ALLOWED_START_AGENTS:
            start_agent = "plan"

        mode_desc = "增量更新" if mode == "incremental" else "重新生成"
        target_info = ""
        if target_ids and target_ids.has_targets():
            parts = []
            if target_ids.character_ids:
                parts.append(f"{len(target_ids.character_ids)} 个角色")
            if target_ids.shot_ids:
                parts.append(f"{len(target_ids.shot_ids)} 个分镜")
            target_info = f"（仅处理 {', '.join(parts)}）"

        await self.send_message(
            ctx,
            f"已收到反馈。将从 {start_agent} 阶段开始{mode_desc}{target_info}。",
            summary="已收到反馈",
        )

        return {
            "start_agent": start_agent,
            "mode": mode,
            "reason": f"feedback_type={feedback_type}",
            "target_ids": target_ids,
        }
