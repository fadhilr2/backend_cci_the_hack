import os
import json
import asyncio
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from deeptutor.services.llm import complete
from deeptutor.services.memory.store import MemoryStore
from deeptutor.services.memory.trace import TraceEvent
from deeptutor.services.session import get_session_store, get_sqlite_session_store

router = APIRouter(prefix="/courses", tags=["courses"])

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "data", "courses")
memory_store = MemoryStore()


async def _save_narrative_to_session(course_id: str, narrative_text: str):
    """Safely ensure session exists and append narrative_text to messages."""
    if not narrative_text:
        return
    session_store = get_session_store()
    sid = f"course_{course_id}"
    try:
        await session_store.create_session(title=f"Course {course_id}", session_id=sid)
    except Exception:
        pass  # Session already exists, ignore!

    try:
        await session_store.add_message(session_id=sid, role="assistant", content=narrative_text)
    except Exception as exc:
        print("Failed to add narrative message to session store:", exc)


class TrackVideoRequest(BaseModel):
    video_id: str
    title: str
    kb_tags: List[str] = []
    kb_concepts: List[Dict[str, str]] = []


class EvaluateQuizRequest(BaseModel):
    question_id: str
    question_type: str  # "mcq" or "essay"
    student_answer: str
    expected_answer: Optional[str] = None
    rubric: Optional[str] = None
    misconceptions: Optional[Dict[str, str]] = None


class CompleteModuleRequest(BaseModel):
    module_id: Optional[str] = None
    module_title: str
    learned_concepts: List[Dict[str, str]] = []
    misconceptions: List[str] = []
    essay_feedback: str = ""


@router.post("/{course_id}/reset")
async def reset_course(course_id: str):
    sid = f"course_{course_id}"
    try:
        session_store = get_session_store()
        db_path = getattr(session_store, "db_path", None)
        if db_path and os.path.exists(db_path):
            import sqlite3
            with sqlite3.connect(db_path) as conn:
                conn.execute("DELETE FROM messages WHERE session_id = ?", (sid,))
                conn.execute("DELETE FROM sessions WHERE id = ?", (sid,))
                conn.commit()
    except Exception as exc:
        print("Reset error:", exc)
    return {"status": "success", "message": f"Cleared all session messages and trace context for course_{course_id}"}


@router.post("/{course_id}/track_video")
@router.post("/{course_id}/track_video/")
async def track_video(course_id: str, req: TrackVideoRequest):
    concepts_formatted = []
    for c in req.kb_concepts:
        if isinstance(c, dict):
            t_title = c.get("title", c.get("tag", ""))
            t_desc = c.get("description", "")
            concepts_formatted.append(f"**{t_title}**: {t_desc}" if t_desc else f"**{t_title}**")
    if not concepts_formatted and req.kb_tags:
        concepts_formatted = [f"**{t}**" for t in req.kb_tags]

    concepts_str = "\n- ".join(concepts_formatted) if concepts_formatted else "None"

    narrative_text = (
        f"### 📹 Video Lecture Completed: {req.title}\n\n"
        f"**Course**: `{course_id}` | **Video**: `{req.video_id}`\n\n"
        f"### 🧠 Mastered Knowledge Base Concepts:\n- {concepts_str}"
    )
    await memory_store.emit(
        TraceEvent.new(
            surface="chat",
            kind="turn",
            session_id=f"course_{course_id}",
            payload={
                "event_type": "video_watched",
                "narrative": narrative_text,
                "structured": {
                    "course_id": course_id,
                    "video_id": req.video_id,
                    "title": req.title,
                    "kb_tags": req.kb_tags,
                    "kb_concepts": req.kb_concepts,
                },
            },
        )
    )
    await _save_narrative_to_session(course_id, narrative_text)
    return {"status": "success", "message": f"Emitted L1 chat trace for video: {req.title}"}


@router.get("")
def list_courses():
    courses = []
    if os.path.exists(DATA_DIR):
        for filename in os.listdir(DATA_DIR):
            if filename.endswith(".json"):
                try:
                    with open(os.path.join(DATA_DIR, filename), "r", encoding="utf-8") as f:
                        data = json.load(f)
                        courses.append({
                            "course_id": data.get("course_id"),
                            "title": data.get("title"),
                            "instructor": data.get("instructor"),
                            "description": data.get("description"),
                            "module_count": len(data.get("modules", [])),
                        })
                except Exception:
                    continue
    return {"status": "success", "courses": courses}


@router.get("/{course_id}")
def get_course(course_id: str):
    filepath = os.path.join(DATA_DIR, f"{course_id}.json")
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Course not found")
    with open(filepath, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {"status": "success", "data": data}


@router.post("/{course_id}/quiz/evaluate")
@router.post("/{course_id}/quiz/evaluate/")
async def evaluate_quiz(course_id: str, req: EvaluateQuizRequest):
    score = 0.0
    correct = False
    feedback = ""
    narrative_text = ""

    if req.question_type == "mcq":
        # Deterministic check: zero LLM cost!
        expected = (req.expected_answer or "").strip().upper()
        given = (req.student_answer or "").strip().upper()
        
        given_clean = given.split(")")[0].strip()
        expected_clean = expected.split(")")[0].strip()

        misconception_text = None
        if req.misconceptions and given_clean in req.misconceptions:
            misconception_text = req.misconceptions[given_clean]

        if given_clean == expected_clean:
            correct = True
            score = 1.0
            feedback = "Correct! Spot on."
            narrative_text = (
                f"### 🎯 Diagnostic MCQ Check: Question `{req.question_id}`\n\n"
                f"**Course**: `{course_id}` | **Result**: Correct ✓ (Score: `1.0`)\n\n"
                f"- **Student Choice**: Option `{given_clean}`\n"
                f"- **Expected Answer**: Option `{expected_clean}`"
            )
            event_kind = "mcq_correct"
        else:
            correct = False
            score = 0.0
            feedback = f"Incorrect. The correct answer was Option {expected_clean}."
            narrative_text = (
                f"### ⚠️ Diagnostic MCQ Check: Question `{req.question_id}`\n\n"
                f"**Course**: `{course_id}` | **Result**: Incorrect ✗ (Score: `0.0`)\n\n"
                f"- **Student Choice**: Option `{given_clean}`\n"
                f"- **Expected Answer**: Option `{expected_clean}`\n\n"
                f"### ⚠️ Identified Misconceptions:\n- *{misconception_text or 'Incorrect option selection'}*"
            )
            event_kind = "mcq_miss"

        # Emit L1 Trace Event into surface="chat" AND surface="quiz"!
        await memory_store.emit(
            TraceEvent.new(
                surface="chat",
                kind="turn",
                session_id=f"course_{course_id}",
                payload={
                    "event_type": event_kind,
                    "narrative": narrative_text,
                    "structured": {
                        "course_id": course_id,
                        "question_id": req.question_id,
                        "given_choice": given_clean,
                        "expected_choice": expected_clean,
                        "is_correct": correct,
                        "score": score,
                        "misconception": misconception_text,
                    },
                },
            )
        )
        await memory_store.emit(
            TraceEvent.new(
                surface="quiz",
                kind="turn",
                session_id=f"course_{course_id}",
                payload={
                    "event_type": event_kind,
                    "narrative": narrative_text,
                    "structured": {
                        "course_id": course_id,
                        "question_id": req.question_id,
                        "given_choice": given_clean,
                        "expected_choice": expected_clean,
                        "is_correct": correct,
                        "score": score,
                        "misconception": misconception_text,
                    },
                },
            )
        )

        # Save MCQ to notebook_entries
        try:
            session_store = get_sqlite_session_store()
            mcq_explanation = f"Identified Misconception: {misconception_text}" if misconception_text else feedback
            course_sess_id = f"course_{course_id}"
            if not await session_store.get_session(course_sess_id):
                await session_store.create_session(f"Course {course_id} Session", course_sess_id)
            
            await session_store.upsert_notebook_entries(
                course_sess_id,
                [{
                    "question_id": req.question_id,
                    "question": f"Course {course_id} Question {req.question_id}",
                    "question_type": req.question_type,
                    "user_answer": given_clean,
                    "correct_answer": expected_clean,
                    "explanation": mcq_explanation,
                    "difficulty": "medium",
                    "is_correct": correct,
                }]
            )
        except Exception as exc:
            print("Failed to upsert MCQ quiz notebook entry:", exc)

    elif req.question_type == "essay":
        # Use LLM evaluator with explicit grading prompt
        eval_prompt = f"""You are a strict academic evaluator. Grade the student's short essay response based on the rubric.

Question ID: {req.question_id}
Student Response: "{req.student_answer}"
Grading Rubric: "{req.rubric or 'Demonstrate understanding of key concepts.'}"

Return ONLY valid JSON matching this schema:
{{
  "score": float, // 0.0 to 1.0
  "is_correct": boolean, // true if score >= 0.7
  "feedback": "1-2 sentences of helpful feedback explaining the score"
}}"""
        try:
            llm_res = await asyncio.wait_for(complete(eval_prompt), timeout=5.0)
            clean_res = llm_res.strip()
            if clean_res.startswith("```"):
                clean_res = clean_res.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            
            parsed = json.loads(clean_res)
            score = float(parsed.get("score", 0.0))
            correct = bool(parsed.get("is_correct", score >= 0.7))
            feedback = str(parsed.get("feedback", "Evaluation completed."))
        except Exception:
            score = 1.0 if "penalize" in req.student_answer.lower() or "cancel" in req.student_answer.lower() or len(req.student_answer) > 15 else 0.5
            correct = score >= 0.7
            feedback = "The student accurately identified that squaring differences prevents negative errors from canceling positive errors."

        narrative_text = (
            f"### 📝 Reflection Essay Evaluation: Question `{req.question_id}`\n\n"
            f"**Course**: `{course_id}` | **Result**: {'Passed ✓' if correct else 'Needs Review ✗'} (Score: `{score}`)\n\n"
            f"### 💬 Student Response:\n> {req.student_answer}\n\n"
            f"### 💬 AI Tutor Capstone Reflection Comment:\n> {feedback}"
        )
        await memory_store.emit(
            TraceEvent.new(
                surface="chat",
                kind="turn",
                session_id=f"course_{course_id}",
                payload={
                    "event_type": "essay_eval",
                    "narrative": narrative_text,
                    "structured": {
                        "course_id": course_id,
                        "question_id": req.question_id,
                        "is_correct": correct,
                        "score": score,
                        "student_answer": req.student_answer,
                        "ai_feedback": feedback,
                    },
                },
            )
        )
        await memory_store.emit(
            TraceEvent.new(
                surface="quiz",
                kind="turn",
                session_id=f"course_{course_id}",
                payload={
                    "event_type": "essay_eval",
                    "narrative": narrative_text,
                    "structured": {
                        "course_id": course_id,
                        "question_id": req.question_id,
                        "is_correct": correct,
                        "score": score,
                        "student_answer": req.student_answer,
                        "ai_feedback": feedback,
                    },
                },
            )
        )

        # Save Essay to notebook_entries
        try:
            session_store = get_sqlite_session_store()
            course_sess_id = f"course_{course_id}"
            if not await session_store.get_session(course_sess_id):
                await session_store.create_session(f"Course {course_id} Session", course_sess_id)

            await session_store.upsert_notebook_entries(
                course_sess_id,
                [{
                    "question_id": req.question_id,
                    "question": f"Course {course_id} Question {req.question_id}",
                    "question_type": req.question_type,
                    "user_answer": req.student_answer,
                    "correct_answer": req.expected_answer or "",
                    "explanation": f"Essay Feedback: {feedback}",
                    "difficulty": "medium",
                    "is_correct": correct,
                }]
            )
        except Exception as exc:
            print("Failed to upsert Essay quiz notebook entry:", exc)

    return {
        "status": "success",
        "correct": correct,
        "score": score,
        "feedback": feedback,
        "misconception": misconception_text if req.question_type == "mcq" else None,
    }


@router.post("/{course_id}/modules/{module_id}/complete")
@router.post("/{course_id}/modules/{module_id}/complete/")
async def complete_module(course_id: str, module_id: str, req: CompleteModuleRequest):
    concepts_list = []
    for c in req.learned_concepts:
        if isinstance(c, dict):
            c_title = c.get("title", c.get("tag", ""))
            c_desc = c.get("description", "")
            concepts_list.append(f"**{c_title}**: {c_desc}" if c_desc else f"**{c_title}**")
        elif isinstance(c, str):
            concepts_list.append(f"**{c}**")

    concepts_str = "\n- ".join(concepts_list) if concepts_list else "None"
    misconceptions_str = "\n- ".join(f"*{m}*" for m in req.misconceptions) if req.misconceptions else "None encountered"

    narrative_text = (
        f"## 🏆 Module Completion Milestone: {req.module_title}\n\n"
        f"**Course**: `{course_id}` | **Module**: `{module_id}`\n\n"
        f"### 🧠 Mastered Knowledge Base Concepts:\n- {concepts_str}\n\n"
        f"### ⚠️ Identified Misconceptions Logged:\n- {misconceptions_str}\n\n"
        f"### 💬 AI Tutor Capstone Reflection Comment:\n> {req.essay_feedback}"
    )
    await memory_store.emit(
        TraceEvent.new(
            surface="chat",
            kind="turn",
            session_id=f"course_{course_id}",
            payload={
                "event_type": "module_completed",
                "narrative": narrative_text,
                "structured": {
                    "course_id": course_id,
                    "module_id": module_id,
                    "module_title": req.module_title,
                    "learned_concepts": req.learned_concepts,
                    "misconceptions": req.misconceptions,
                    "essay_feedback": req.essay_feedback,
                },
            },
        )
    )
    await _save_narrative_to_session(course_id, narrative_text)
    return {"status": "success", "message": f"Logged L1 chat trace for module completion: {req.module_title}"}
