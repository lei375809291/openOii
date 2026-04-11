from __future__ import annotations

from typing import Any

from langgraph.runtime import Runtime
from langgraph.types import interrupt

from app.agents.review import ALLOWED_START_AGENTS
from app.services.approval_gate import can_enter_clip_generation

from .state import Phase2RuntimeContext, Phase2State


_STAGE_ARTIFACT_KEYS: dict[str, str] = {
    "ideate": "stage:ideate",
    "script": "stage:script",
    "character": "stage:character",
    "storyboard": "stage:storyboard",
    "clip": "stage:clip",
    "merge": "stage:merge",
}

_STAGE_TO_AGENTS: dict[str, tuple[str, ...]] = {
    "ideate": ("onboarding", "director"),
    "script": ("scriptwriter",),
    "character": ("character_artist",),
    "storyboard": ("storyboard_artist",),
    "clip": ("video_generator",),
    "merge": ("video_merger",),
}

_START_AGENT_TO_STAGE: dict[str, str] = {
    "scriptwriter": "script",
    "character_artist": "character",
    "storyboard_artist": "storyboard",
    "video_generator": "clip",
    "video_merger": "merge",
}


def _stage_key(stage: str) -> str:
    return _STAGE_ARTIFACT_KEYS[stage]


def _should_skip_stage(state: Phase2State, stage: str) -> bool:
    artifact_lineage = state.get("artifact_lineage") or []
    return _stage_key(stage) in artifact_lineage


async def _run_agent_sequence(
    state: Phase2State,
    runtime: Runtime[Phase2RuntimeContext],
    *,
    stage: str,
) -> dict[str, Any]:
    if _should_skip_stage(state, stage):
        return {"current_stage": stage}

    orchestrator = runtime.context.orchestrator
    agent_ctx = runtime.context.agent_context
    agent_names = _STAGE_TO_AGENTS[stage]
    total = max(len(agent_names), 1)

    for index, agent_name in enumerate(agent_names):
        prev_agent = agent_names[index - 1] if index > 0 else None
        if prev_agent:
            await orchestrator.ws.send_event(
                agent_ctx.project.id,
                {
                    "type": "agent_handoff",
                    "data": {
                        "from_agent": prev_agent,
                        "to_agent": agent_name,
                        "message": f"@{prev_agent} 邀请 @{agent_name} 加入了群聊",
                    },
                },
            )

        progress = index / max(total, 1)
        await orchestrator._set_run(  # noqa: SLF001 - orchestration helper
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
                    "stage": stage,
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


async def ideate_node(state: Phase2State, runtime: Runtime[Phase2RuntimeContext]) -> dict[str, Any]:
    return await _run_agent_sequence(state, runtime, stage="ideate")


async def script_node(state: Phase2State, runtime: Runtime[Phase2RuntimeContext]) -> dict[str, Any]:
    return await _run_agent_sequence(state, runtime, stage="script")


async def character_node(
    state: Phase2State, runtime: Runtime[Phase2RuntimeContext]
) -> dict[str, Any]:
    return await _run_agent_sequence(state, runtime, stage="character")


async def character_approval_node(
    state: Phase2State, runtime: Runtime[Phase2RuntimeContext]
) -> dict[str, Any]:
    if runtime.context.auto_mode:
        return {
            "current_stage": "character_approval",
            "approval_history": ["character"],
            "approval_feedback": "",
            "review_requested": False,
            "route_stage": "storyboard",
        }

    resume_value = interrupt(
        {
            "gate": "character_artist",
            "message": "角色设计已生成，请确认是否继续进入分镜阶段。",
        }
    )
    feedback = _normalize_resume_value(resume_value)
    review_requested = bool(feedback)
    return {
        "current_stage": "character_approval",
        "approval_history": ["character"],
        "approval_feedback": feedback,
        "review_requested": review_requested,
        "route_stage": "review" if review_requested else "storyboard",
    }


async def storyboard_node(
    state: Phase2State, runtime: Runtime[Phase2RuntimeContext]
) -> dict[str, Any]:
    return await _run_agent_sequence(state, runtime, stage="storyboard")


async def storyboard_approval_node(
    state: Phase2State, runtime: Runtime[Phase2RuntimeContext]
) -> dict[str, Any]:
    agent_ctx = runtime.context.agent_context
    clip_ready = await can_enter_clip_generation(agent_ctx.session, agent_ctx.run)
    if not clip_ready:
        return {
            "current_stage": "storyboard_approval",
            "approval_history": ["storyboard"],
            "approval_feedback": "Storyboard shots are still pending approval.",
            "review_requested": True,
            "route_stage": "review",
        }

    if runtime.context.auto_mode:
        return {
            "current_stage": "storyboard_approval",
            "approval_history": ["storyboard"],
            "approval_feedback": "",
            "review_requested": False,
            "route_stage": "clip",
        }

    resume_value = interrupt(
        {
            "gate": "storyboard_artist",
            "message": "分镜图已生成，请确认是否继续进入视频生成阶段。",
        }
    )
    feedback = _normalize_resume_value(resume_value)
    review_requested = bool(feedback)
    return {
        "current_stage": "storyboard_approval",
        "approval_history": ["storyboard"],
        "approval_feedback": feedback,
        "review_requested": review_requested,
        "route_stage": "review" if review_requested else "clip",
    }


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
        start_agent = "scriptwriter"
    start_agent = start_agent.strip()
    if start_agent not in ALLOWED_START_AGENTS:
        start_agent = "scriptwriter"

    agent_ctx.rerun_mode = mode
    if target_ids is not None:
        agent_ctx.target_ids = target_ids

    await orchestrator._cleanup_for_rerun(  # noqa: SLF001 - orchestration helper
        agent_ctx.project.id,
        start_agent,
        mode=mode,
    )
    await orchestrator.session.refresh(agent_ctx.project)

    return {
        "current_stage": "review",
        "route_stage": _START_AGENT_TO_STAGE[start_agent],
        "route_mode": mode,
        "review_requested": False,
        "approval_history": [f"review:{start_agent}:{mode}"],
    }


async def clip_node(state: Phase2State, runtime: Runtime[Phase2RuntimeContext]) -> dict[str, Any]:
    return await _run_agent_sequence(state, runtime, stage="clip")


async def merge_node(state: Phase2State, runtime: Runtime[Phase2RuntimeContext]) -> dict[str, Any]:
    return await _run_agent_sequence(state, runtime, stage="merge")


def route_after_character_approval(state: Phase2State) -> str:
    return "review" if state.get("review_requested") else "storyboard"


def route_after_storyboard_approval(state: Phase2State) -> str:
    return "review" if state.get("review_requested") else "clip"


def route_after_review(state: Phase2State) -> str:
    return state.get("route_stage") or "script"


def route_from_start(state: Phase2State) -> str:
    return state.get("current_stage") or "ideate"


def _normalize_resume_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        maybe_feedback = value.get("feedback")
        if isinstance(maybe_feedback, str):
            return maybe_feedback.strip()
        maybe_text = value.get("text")
        if isinstance(maybe_text, str):
            return maybe_text.strip()
    return str(value).strip()
