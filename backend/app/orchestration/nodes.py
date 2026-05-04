from __future__ import annotations

from typing import Any

from langgraph.runtime import Runtime
from langgraph.types import interrupt

from app.agents.review_rules import ALLOWED_START_AGENTS
from .state import (
    Phase2RuntimeContext,
    Phase2State,
    next_production_stage,
    workflow_progress_for_stage,
)


_STAGE_ARTIFACT_KEYS: dict[str, str] = {
    "plan": "stage:plan",
    "render": "stage:render",
    "compose": "stage:compose",
}

_STAGE_TO_AGENTS: dict[str, tuple[str, ...]] = {
    "plan": ("plan",),
    "render": ("render",),
    "compose": ("compose",),
}

_START_AGENT_TO_STAGE: dict[str, str] = {
    "plan": "plan",
    "render": "render",
    "compose": "compose",
}


def _stage_key(stage: str) -> str:
    return _STAGE_ARTIFACT_KEYS[stage]


def _should_skip_stage(state: Phase2State, stage: str) -> bool:
    artifact_lineage = state.get("artifact_lineage") or []
    return _stage_key(stage) in artifact_lineage


def _is_video_provider_invalid(run_snapshot: dict[str, Any] | None) -> bool:
    if not isinstance(run_snapshot, dict):
        return False
    video_snapshot = run_snapshot.get("video")
    if not isinstance(video_snapshot, dict):
        return False
    return video_snapshot.get("valid") is False


def _get_run_provider_snapshot(agent_ctx: Any) -> dict[str, Any] | None:
    if not hasattr(agent_ctx, "run"):
        return None
    run = getattr(agent_ctx, "run")
    return getattr(run, "provider_snapshot", None)


async def _run_agent_sequence(
    state: Phase2State,
    runtime: Runtime[Phase2RuntimeContext],
    *,
    stage: str,
) -> dict[str, Any]:
    agent_ctx = runtime.context.agent_context
    if stage == "compose" and _is_video_provider_invalid(
        _get_run_provider_snapshot(agent_ctx)
    ):
        return {
            "current_stage": stage,
            "stage_history": [stage],
            "artifact_lineage": [_stage_key(stage)],
        }

    if _should_skip_stage(state, stage):
        return {"current_stage": stage}

    orchestrator = runtime.context.orchestrator
    agent_names = _STAGE_TO_AGENTS[stage]
    total = max(len(agent_names), 1)

    for index, agent_name in enumerate(agent_names):
        stage_progress = index / max(total, 1)
        progress = workflow_progress_for_stage(stage, within_stage=stage_progress)
        await orchestrator._set_run(  # noqa: SLF001
            agent_ctx.run,
            current_agent=agent_name,
            progress=progress,
        )
        await orchestrator.ws.send_event(
            agent_ctx.project.id,
            {
                "type": "run_progress",
                "data": {
                    "run_id": agent_ctx.run.id,
                    "current_agent": agent_name,
                    "current_stage": stage,
                    "stage": stage,
                    "next_stage": next_production_stage(stage),
                    "progress": progress,
                },
            },
        )

        agent = orchestrator.agents[orchestrator._agent_index(agent_name)]  # noqa: SLF001
        await agent.run(agent_ctx)

    return {
        "current_stage": stage,
        "stage_history": [stage],
        "artifact_lineage": [_stage_key(stage)],
    }


def _approval_result(
    *,
    approval_stage: str,
    history_key: str,
    next_stage: str,
    feedback: str,
) -> dict[str, Any]:
    review_requested = bool(feedback)
    return {
        "current_stage": approval_stage,
        "approval_history": [history_key],
        "approval_feedback": feedback,
        "review_requested": review_requested,
        "route_stage": "review" if review_requested else next_stage,
    }


def _auto_approval_result(*, approval_stage: str, history_key: str, next_stage: str) -> dict[str, Any]:
    return {
        "current_stage": approval_stage,
        "approval_history": [history_key],
        "approval_feedback": "",
        "review_requested": False,
        "route_stage": next_stage,
    }


async def _manual_approval_node(
    runtime: Runtime[Phase2RuntimeContext],
    *,
    approval_stage: str,
    history_key: str,
    gate: str,
    message: str,
    next_stage: str,
) -> dict[str, Any]:
    agent_ctx = runtime.context.agent_context
    orchestrator = runtime.context.orchestrator

    approval_progress = workflow_progress_for_stage(approval_stage)

    await orchestrator._set_run(  # noqa: SLF001
        agent_ctx.run,
        current_agent=gate,
        progress=approval_progress,
    )
    await orchestrator.ws.send_event(
        agent_ctx.project.id,
        {
            "type": "run_progress",
            "data": {
                "run_id": agent_ctx.run.id,
                "current_agent": gate,
                "current_stage": approval_stage,
                "stage": approval_stage,
                "next_stage": next_stage,
                "progress": approval_progress,
            },
        },
    )

    if runtime.context.auto_mode:
        return _auto_approval_result(
            approval_stage=approval_stage,
            history_key=history_key,
            next_stage=next_stage,
        )

    resume_value = interrupt({"gate": gate, "message": message})
    feedback = _normalize_resume_value(resume_value)
    return _approval_result(
        approval_stage=approval_stage,
        history_key=history_key,
        next_stage=next_stage,
        feedback=feedback,
    )


async def plan_node(state: Phase2State, runtime: Runtime[Phase2RuntimeContext]) -> dict[str, Any]:
    return await _run_agent_sequence(state, runtime, stage="plan")


async def plan_approval_node(
    state: Phase2State, runtime: Runtime[Phase2RuntimeContext]
) -> dict[str, Any]:
    return await _manual_approval_node(
        runtime,
        approval_stage="plan_approval",
        history_key="plan",
        gate="plan",
        message="创作方案已规划（含角色和分镜），请确认是否继续进入渲染阶段。",
        next_stage="render",
    )


async def render_node(state: Phase2State, runtime: Runtime[Phase2RuntimeContext]) -> dict[str, Any]:
    return await _run_agent_sequence(state, runtime, stage="render")


async def render_approval_node(
    state: Phase2State, runtime: Runtime[Phase2RuntimeContext]
) -> dict[str, Any]:
    agent_ctx = runtime.context.agent_context
    if _is_video_provider_invalid(_get_run_provider_snapshot(agent_ctx)):
        orchestrator = runtime.context.orchestrator
        approval_progress = workflow_progress_for_stage("render_approval")
        await orchestrator._set_run(  # noqa: SLF001
            agent_ctx.run,
            current_agent="render",
            progress=approval_progress,
        )
        await orchestrator.ws.send_event(
            agent_ctx.project.id,
            {
                "type": "run_progress",
                "data": {
                    "run_id": agent_ctx.run.id,
                    "current_agent": "render",
                    "current_stage": "render_approval",
                    "stage": "render_approval",
                    "next_stage": "compose",
                    "progress": approval_progress,
                },
            },
        )
        return _auto_approval_result(
            approval_stage="render_approval",
            history_key="render",
            next_stage="compose",
        )

    if runtime.context.auto_mode:
        return _auto_approval_result(
            approval_stage="render_approval",
            history_key="render",
            next_stage="compose",
        )

    return await _manual_approval_node(
        runtime,
        approval_stage="render_approval",
        history_key="render",
        gate="render",
        message="角色形象图和分镜首帧图已生成，请确认是否继续进入视频合成阶段。",
        next_stage="compose",
    )


async def compose_node(state: Phase2State, runtime: Runtime[Phase2RuntimeContext]) -> dict[str, Any]:
    return await _run_agent_sequence(state, runtime, stage="compose")


async def review_node(state: Phase2State, runtime: Runtime[Phase2RuntimeContext]) -> dict[str, Any]:
    orchestrator = runtime.context.orchestrator
    agent_ctx = runtime.context.agent_context

    review_agent = orchestrator.agents[orchestrator._agent_index("review")]  # noqa: SLF001

    approval_feedback = state.get("approval_feedback", "")
    if approval_feedback:
        agent_ctx.user_feedback = approval_feedback

    routing = await review_agent.run(agent_ctx)
    start_agent = routing.get("start_agent") if isinstance(routing, dict) else None
    mode = "full"
    target_ids = None
    if isinstance(routing, dict):
        maybe_mode = routing.get("mode")
        if isinstance(maybe_mode, str) and maybe_mode.strip() in {"incremental", "full"}:
            mode = maybe_mode.strip()
        target_ids = routing.get("target_ids")

    if not (isinstance(start_agent, str) and start_agent.strip()):
        start_agent = "plan"
    start_agent = start_agent.strip()
    if start_agent not in ALLOWED_START_AGENTS:
        start_agent = "plan"

    agent_ctx.rerun_mode = mode
    if target_ids is not None:
        agent_ctx.target_ids = target_ids

    await orchestrator._cleanup_for_rerun(  # noqa: SLF001
        agent_ctx.project.id,
        start_agent,
        mode=mode,
    )
    await orchestrator.session.refresh(agent_ctx.project)

    return {
        "current_stage": "review",
        "route_stage": _START_AGENT_TO_STAGE.get(start_agent, "plan"),
        "route_mode": mode,
        "review_requested": False,
        "approval_history": [f"review:{start_agent}:{mode}"],
    }


def route_from_start(state: Phase2State) -> str:
    return state.get("current_stage") or "plan"


def route_after_plan_approval(state: Phase2State) -> str:
    return state.get("route_stage") or ("review" if state.get("review_requested") else "render")


def route_after_render_approval(state: Phase2State) -> str:
    return state.get("route_stage") or ("review" if state.get("review_requested") else "compose")


def route_after_review(state: Phase2State) -> str:
    return state.get("route_stage") or "plan"


def _normalize_resume_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        maybe_action = value.get("action")
        maybe_feedback = value.get("feedback")
        if isinstance(maybe_feedback, str) and maybe_feedback.strip():
            return maybe_feedback.strip()
        if isinstance(maybe_action, str) and maybe_action == "approve":
            return ""
        if isinstance(maybe_action, str) and maybe_action == "reject":
            return value.get("reason", "") if isinstance(value.get("reason"), str) else ""
        maybe_text = value.get("text")
        if isinstance(maybe_text, str):
            return maybe_text.strip()
    return str(value).strip()
