from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.agent_run import AgentRun
from app.models.project import Shot


async def can_enter_clip_generation(session: AsyncSession, run: AgentRun) -> bool:
    if run.id is None:
        return False

    result = await session.execute(
        select(Shot).where(Shot.project_id == run.project_id).order_by(Shot.order)
    )
    shots = result.scalars().all()
    if not shots:
        return False

    return all(shot.approval_state == "approved" for shot in shots)
