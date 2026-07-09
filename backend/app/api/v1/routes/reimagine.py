"""拉片复刻 v0 API."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.deps import SettingsDep
from app.config import Settings
from app.services.reimagine import ReimagineAnalysis, ReimagineRequest, analyze_reimagine
from app.services.text_factory import create_text_service

router = APIRouter(prefix="/reimagine", tags=["reimagine"])


@router.post("/analyze", response_model=ReimagineAnalysis)
async def analyze_reference(
    payload: ReimagineRequest,
    settings: Settings = SettingsDep,
) -> ReimagineAnalysis:
    """Break down a reference brief into director dimensions + replaceable slots.

    v0 accepts text (transcript, shot notes, or free-form description).
    Returns a reconstructed prompt suitable for project.story / generate notes.
    """
    llm = None
    try:
        llm = create_text_service(settings)
    except Exception:
        llm = None
    return await analyze_reimagine(payload, llm=llm)
