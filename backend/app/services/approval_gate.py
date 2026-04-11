from __future__ import annotations

from typing import cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute

from app.models.agent_run import AgentRun
from app.models.project import Shot


async def can_enter_clip_generation(session: AsyncSession, run: AgentRun) -> bool:
    if run.id is None:
        return False

    shot_project_id_col = cast(InstrumentedAttribute[int], cast(object, Shot.project_id))
    shot_order_col = cast(InstrumentedAttribute[int], cast(object, Shot.order))
    result = await session.execute(
        select(Shot).where(shot_project_id_col == run.project_id).order_by(shot_order_col)
    )
    shots = result.scalars().all()
    if not shots:
        return False

    return all(shot.approval_state == "approved" for shot in shots)
