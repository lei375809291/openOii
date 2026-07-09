"""LangGraph execution driver.

Encapsulates the interrupt/resume loop recommended by LangGraph docs:
- checkpointer + stable thread_id
- interrupt() payloads via result["__interrupt__"] (invoke API)
- resume exclusively with Command(resume=...)

Keeping this out of GenerationOrchestrator makes HITL policy injectable and testable.
"""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from langgraph.types import Command

logger = logging.getLogger(__name__)

InterruptHandler = Callable[[Any], Awaitable[dict[str, Any]]]


@dataclass(slots=True)
class GraphRunResult:
    """Final graph state after the interrupt loop exits cleanly."""

    state: dict[str, Any]
    final_stage: str
    video_generation_skipped: bool
    saw_compose_stage: bool
    interrupt_count: int


def _extract_interrupt_value(interrupt_item: Any) -> Any:
    return getattr(interrupt_item, "value", None)


def _video_generation_skipped(result: dict[str, Any]) -> bool:
    if result.get("video_generation_skipped") is True:
        return True
    # Nested / alternate keys used by older nodes
    return bool(result.get("skip_video") is True)


async def drive_graph_until_idle(
    compiled_graph: Any,
    *,
    initial_payload: Any,
    graph_config: dict[str, Any],
    runtime_context: Any,
    on_interrupt: InterruptHandler,
    run_id: int | str | None = None,
) -> GraphRunResult:
    """Invoke graph, handling HITL interrupts until completion.

    Parameters
    ----------
    compiled_graph:
        Output of ``build_phase2_graph().compile(checkpointer=...)``.
    initial_payload:
        Initial state dict, or ``None`` / ``Command`` when resuming a checkpoint.
    on_interrupt:
        Async callback receiving the first Interrupt object; must return a
        JSON-serializable resume payload that becomes the return value of
        ``interrupt()`` inside the paused node.
    """
    payload: Any = initial_payload
    final_stage = "compose"
    saw_compose_stage = False
    video_generation_skipped = False
    interrupt_count = 0
    last_state: dict[str, Any] = {}

    while True:
        logger.debug(
            "[graph-driver] run=%s ainvoke payload_type=%s",
            run_id,
            type(payload).__name__,
        )
        result = await compiled_graph.ainvoke(payload, graph_config, context=runtime_context)
        if not isinstance(result, dict):
            logger.warning(
                "[graph-driver] run=%s non-dict result type=%s",
                run_id,
                type(result).__name__,
            )
            break

        last_state = result
        result_stage = result.get("current_stage")
        if isinstance(result_stage, str) and result_stage:
            final_stage = result_stage
            if result_stage.startswith("compose"):
                saw_compose_stage = True

        if _video_generation_skipped(result):
            video_generation_skipped = True

        interrupts = result.get("__interrupt__") or []
        if not interrupts:
            break

        interrupt_count += 1
        interrupt_item = interrupts[0]
        interrupt_value = _extract_interrupt_value(interrupt_item)
        logger.debug(
            "[graph-driver] run=%s interrupt #%s value=%r",
            run_id,
            interrupt_count,
            interrupt_value,
        )

        resume_payload = await on_interrupt(interrupt_item)
        if not isinstance(resume_payload, dict):
            raise TypeError("on_interrupt must return a dict resume payload")
        # LangGraph: only Command(resume=...) is valid input for resuming interrupts
        payload = Command(resume=resume_payload)

    return GraphRunResult(
        state=last_state,
        final_stage=final_stage,
        video_generation_skipped=video_generation_skipped,
        saw_compose_stage=saw_compose_stage,
        interrupt_count=interrupt_count,
    )


def gate_name_from_interrupt(interrupt_item: Any) -> str:
    """Extract approval gate name from interrupt payload."""
    value = _extract_interrupt_value(interrupt_item)
    if isinstance(value, dict):
        gate = value.get("gate")
        if isinstance(gate, str) and gate.strip():
            return gate.strip()
    raise RuntimeError("LangGraph approval gate did not include a valid gate name")
