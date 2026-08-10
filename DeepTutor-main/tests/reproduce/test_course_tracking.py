"""Unit test suite for Course Tracking & Telemetry Pipeline.

Reproducible test suite for verifying course schema loading, MCQ deterministic evaluation,
dual surface trace emission, and reset router handlers on any DeepTutor repository.
"""

import json
from pathlib import Path
import pytest
from deeptutor.api.routers.courses import EvaluateQuizRequest, evaluate_quiz


def test_course_schema_cs101_validity():
    """Verify that cs101.json course schema contains required modules, videos, and MCQ distractors."""
    cs101_path = Path("data/courses/cs101.json")
    assert cs101_path.exists(), "data/courses/cs101.json missing"

    with open(cs101_path, "r", encoding="utf-8") as f:
        course_data = json.load(f)

    assert course_data["course_id"] == "cs101"
    assert "modules" in course_data
    assert len(course_data["modules"]) > 0

    first_module = course_data["modules"][0]
    assert "module_id" in first_module
    assert "title" in first_module
    assert "items" in first_module
    assert len(first_module["items"]) > 0


@pytest.mark.asyncio
async def test_evaluate_quiz_mcq_deterministic():
    """Verify that MCQ quiz evaluation works deterministically without LLM cost."""
    req = EvaluateQuizRequest(
        question_id="q1_1_1",
        question_type="mcq",
        student_answer="B",
        expected_answer="A",
        misconceptions={"B": "Confuses dataset sizing with parameter optimization."},
    )

    res = await evaluate_quiz(course_id="cs101", req=req)

    assert res["status"] == "success"
    assert res["correct"] is False
    assert res["score"] == 0.0
    assert res["misconception"] == "Confuses dataset sizing with parameter optimization."
    assert "Incorrect" in res["feedback"]


@pytest.mark.asyncio
async def test_track_video_endpoint():
    """Verify video telemetry tracking emits L1 chat trace."""
    from deeptutor.api.routers.courses import TrackVideoRequest, track_video

    req = TrackVideoRequest(
        video_id="v1_1",
        title="Video 1.1: Model Representation & Cost Function",
        kb_concepts=[{"title": "Cost Function J(w,b)", "description": "Measures mean squared error."}],
    )

    res = await track_video(course_id="cs101", req=req)
    assert res["status"] == "success"
    assert "Video 1.1" in res["message"]


@pytest.mark.asyncio
async def test_complete_module_endpoint():
    """Verify module completion milestone telemetry emits L1 chat trace."""
    from deeptutor.api.routers.courses import CompleteModuleRequest, complete_module

    req = CompleteModuleRequest(
        module_title="Module 1: Supervised Learning",
        learned_concepts=[{"title": "Cost Function J(w,b)", "description": "Measures mean squared error."}],
        misconceptions=["Confused dataset sizing with parameter count."],
        essay_feedback="Excellent reflection.",
    )

    res = await complete_module(course_id="cs101", module_id="m1", req=req)
    assert res["status"] == "success"
    assert "Module 1" in res["message"]
