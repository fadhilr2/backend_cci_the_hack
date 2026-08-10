"""
FastAPI router for generating learning roadmaps.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from deeptutor.services.roadmap.generator import generate_roadmap

logger = logging.getLogger(__name__)

router = APIRouter()


class RoadmapRequest(BaseModel):
    topic: str = Field(..., min_length=1, description="Topic to generate a learning roadmap for.")


@router.post("/generate")
@router.post("/generate/")
async def generate_roadmap_endpoint(payload: RoadmapRequest) -> dict[str, Any]:
    try:
        result = await generate_roadmap(payload.topic)
        return result
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as exc:
        logger.exception("Roadmap generation failed for topic %r", payload.topic)
        raise HTTPException(status_code=500, detail=f"Failed to generate roadmap: {exc}")
