from __future__ import annotations

import json
from typing import Any, cast

from sqlalchemy import select
from sqlalchemy.orm import InstrumentedAttribute

from app.agents.base import AgentContext, BaseAgent
from app.agents.prompts.review import SYSTEM_PROMPT
from app.agents.utils import extract_json
from app.models.agent_run import AgentMessage
from app.services.creative_control import build_review_state, infer_feedback_targets


ALLOWED_START_AGENTS = {
    "scriptwriter",
    "character_artist",
    "storyboard_artist",
    "video_generator",
    "video_merger",
}


_RETRY_MERGE_KEYWORDS = (
    "retry merge",
    "重试合成",
    "重新合成",
    "重新拼接最终视频",
    "重新合并最终视频",
    "final-output",
)


def _fallback_start_agent(feedback_type: str | None) -> str:
    if feedback_type == "character":
        return "character_artist"
    if feedback_type == "shot":
        return "storyboard_artist"
    if feedback_type == "video":
        return "video_merger"
    # scene|style|story|general|unknown
    return "scriptwriter"


def _is_retry_merge_feedback(feedback: str) -> bool:
    normalized = feedback.strip().lower()
    return any(keyword in normalized for keyword in _RETRY_MERGE_KEYWORDS)


class ReviewAgent(BaseAgent):
    name = "review"

    async def _get_latest_feedback(self, ctx: AgentContext) -> str:
        run_id = ctx.run.id
        if run_id is None:
            return ""

        agent_message_run_id_col = cast(
            InstrumentedAttribute[int], cast(object, AgentMessage.run_id)
        )
        agent_message_role_col = cast(InstrumentedAttribute[str], cast(object, AgentMessage.role))
        agent_message_created_at_col = cast(
            InstrumentedAttribute[Any], cast(object, AgentMessage.created_at)
        )
        res = await ctx.session.execute(
            select(AgentMessage)
            .where(agent_message_run_id_col == run_id)
            .where(agent_message_role_col == "user")
            .order_by(agent_message_created_at_col.desc())
            .limit(1)
        )
        msg = res.scalars().first()
        return msg.content if msg else ""

    async def _get_project_state(self, ctx: AgentContext) -> dict[str, Any]:
        return await build_review_state(ctx.session, ctx.project)

    async def run(self, ctx: AgentContext) -> Any:
        # 优先使用 ctx.user_feedback（orchestrator 已设置），DB 查询作为兜底
        feedback = ""
        if hasattr(ctx, "user_feedback") and ctx.user_feedback:
            feedback = ctx.user_feedback.strip()
        if not feedback:
            feedback = (await self._get_latest_feedback(ctx)).strip()
        if not feedback:
            await self.send_message(ctx, "未找到用户反馈内容，将默认从编剧开始重新生成。")
            return {"start_agent": "scriptwriter", "reason": "未提供具体反馈"}

        retry_merge_requested = _is_retry_merge_feedback(feedback)

        state = await self._get_project_state(ctx)
        user_prompt = json.dumps({"feedback": feedback, "state": state}, ensure_ascii=False)

        resp = await self.call_llm(
            ctx, system_prompt=SYSTEM_PROMPT, user_prompt=user_prompt, max_tokens=2048
        )
        data = extract_json(resp.text)

        analysis = data.get("analysis") if isinstance(data, dict) else None
        routing = data.get("routing") if isinstance(data, dict) else None

        feedback_type: str | None = None
        summary: str | None = None
        if isinstance(analysis, dict):
            ft = analysis.get("feedback_type")
            if isinstance(ft, str) and ft.strip():
                feedback_type = ft.strip()
            s = analysis.get("summary")
            if isinstance(s, str) and s.strip():
                summary = s.strip()

        start_agent: str | None = None
        reason: str | None = None
        mode: str = "full"  # 默认全量模式
        if isinstance(routing, dict):
            sa = routing.get("start_agent")
            if isinstance(sa, str) and sa.strip():
                start_agent = sa.strip()
            r = routing.get("reason")
            if isinstance(r, str) and r.strip():
                reason = r.strip()
            # 读取 mode 字段
            m = routing.get("mode")
            if isinstance(m, str) and m.strip() in ("incremental", "full"):
                mode = m.strip()

        target_ids = infer_feedback_targets(data if isinstance(data, dict) else {}, state)

        if start_agent not in ALLOWED_START_AGENTS:
            start_agent = _fallback_start_agent(feedback_type)
            if not reason:
                reason = "未识别到有效的路由结果，采用默认路由策略"

        if retry_merge_requested:
            start_agent = "video_merger"
            mode = "incremental"
            reason = reason or "检测到最终拼接重试请求，直接路由到视频拼接"

        mode_desc = "增量更新" if mode == "incremental" else "重新生成"
        msg_summary = summary or "已收到您的反馈"
        msg_reason = f"原因：{reason}" if reason else ""

        # 如果有精细化控制目标，显示具体信息
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
            f"{msg_summary}。将从 @{start_agent} 开始{mode_desc}{target_info}。{msg_reason}".strip(),
        )

        return {
            "start_agent": start_agent,
            "mode": mode,
            "reason": reason or "",
            "analysis": analysis or {},
            "target_ids": target_ids,
            "raw": data,
        }
