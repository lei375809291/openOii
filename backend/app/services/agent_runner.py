from __future__ import annotations

import asyncio
from typing import Any

from app.agents.base import AgentContext, TargetIds
from app.agents.orchestrator import AGENT_STAGE_MAP
from app.config import Settings
from app.db.session import async_session_maker
from app.db.utils import utcnow
from app.models.agent_run import AgentRun
from app.models.project import Project
from app.orchestration.state import workflow_progress_for_stage
from app.services.image import ImageService
from app.services.llm import LLMService
from app.services.task_manager import task_manager
from app.services.video_factory import create_video_service
from app.ws.manager import ConnectionManager


async def run_agent_plan(
    *,
    project_id: int,
    run_id: int,
    agent_plan: list[Any],
    settings: Settings,
    ws: ConnectionManager,
    target_ids: TargetIds | None = None,
    default_final_stage: str = "ideate",
) -> None:
    try:
        async with async_session_maker() as session:
            project = await session.get(Project, project_id)
            run = await session.get(AgentRun, run_id)
            if not project or not run:
                return

            ctx = AgentContext(
                settings=settings,
                session=session,
                ws=ws,
                project=project,
                run=run,
                llm=LLMService(settings),
                image=ImageService(settings),
                video=create_video_service(settings),
                target_ids=target_ids,
            )

            await ws.send_event(
                project_id,
                {"type": "run_started", "data": {"run_id": run_id, "project_id": project_id, "current_agent": agent_plan[0].name if agent_plan else None}},
            )

            total_steps = max(len(agent_plan), 1)
            for idx, agent in enumerate(agent_plan):
                agent_name = getattr(agent, "name", None)
                stage = AGENT_STAGE_MAP.get(agent_name or "", default_final_stage)
                within = idx / total_steps
                progress = workflow_progress_for_stage(stage, within_stage=within)
                run.status = "running"
                run.current_agent = agent_name
                run.progress = progress
                run.updated_at = utcnow()
                session.add(run)
                await session.commit()

                await ws.send_event(
                    project_id,
                    {
                        "type": "run_progress",
                        "data": {
                            "run_id": run_id,
                            "current_agent": run.current_agent,
                            "stage": stage,
                            "progress": progress,
                        },
                    },
                )

                await agent.run(ctx)
                await session.refresh(ctx.project)

            run.status = "succeeded"
            run.current_agent = None
            run.progress = 1.0
            run.updated_at = utcnow()
            session.add(run)
            await session.commit()

            last_agent_name = getattr(agent_plan[-1], "name", None) if agent_plan else None
            final_stage = AGENT_STAGE_MAP.get(last_agent_name or "", default_final_stage)
            await ws.send_event(
                project_id,
                {
                    "type": "run_completed",
                    "data": {"run_id": run_id, "current_stage": final_stage},
                },
            )
    except asyncio.CancelledError:
        async with async_session_maker() as cancel_session:
            run = await cancel_session.get(AgentRun, run_id)
            if run and run.status not in ("cancelled", "failed", "succeeded"):
                run.status = "cancelled"
                run.updated_at = utcnow()
                cancel_session.add(run)
                await cancel_session.commit()
        await ws.send_event(project_id, {"type": "run_cancelled", "data": {"run_id": run_id}})
        raise
    except Exception as e:
        async with async_session_maker() as fail_session:
            run = await fail_session.get(AgentRun, run_id)
            if run and run.status not in ("cancelled", "failed", "succeeded"):
                run.status = "failed"
                run.error = str(e)
                run.updated_at = utcnow()
                fail_session.add(run)
                await fail_session.commit()
        await ws.send_event(
            project_id, {"type": "run_failed", "data": {"run_id": run_id, "error": str(e)}}
        )
    finally:
        task_manager.remove(project_id)
