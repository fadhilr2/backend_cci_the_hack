"""
Roadmap generation service using DeepTutor primary LLM model with error handler and repair.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from deeptutor.services.llm import complete, get_llm_config

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a curriculum designer. Given a topic, produce a learning roadmap.

Return ONLY valid JSON. No markdown fences, no commentary, no preamble — just the JSON object.

Schema:
{
  "topic": string,
  "roadmap": [
    {
      "id": string,              // "1", "2", "3"...
      "title": string,
      "description": string,     // 1-2 sentences, what this step covers
      "duration": string,        // e.g. "1 week", "3 days"
      "prerequisite_context": string // plain-language note on what you should already know, "" if none
    }
  ]
}

Rules:
- 6 to 10 concise steps, ordered from beginner to advanced.
- Each step should be genuinely learnable in the stated duration.
- prerequisite_context should read like a friendly nudge, not a hard gate.
- Output must be a single JSON object and nothing else."""


def build_user_prompt(topic: str) -> str:
    return f"Generate a learning roadmap for: {topic}"


def build_repair_prompt(broken_text: str, error_message: str) -> str:
    return f"""Your previous response could not be parsed as valid JSON matching the required schema.

Error: {error_message}

Your previous response was:
---
{broken_text[:4000]}
---

Fix it. Return ONLY the corrected JSON object — no markdown fences, no commentary."""


def extract_json(text: str) -> dict[str, Any]:
    cleaned = re.sub(r"```(?:json)?\s*|```", "", text, flags=re.IGNORECASE).strip()
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in model output")

    substring = cleaned[start : end + 1]
    try:
        res = json.loads(substring)
        if isinstance(res, dict):
            return res
    except Exception:
        pass

    try:
        import json_repair
        repaired = json_repair.loads(substring)
        if isinstance(repaired, dict):
            return repaired
    except Exception:
        pass

    raise ValueError("Failed to parse JSON object from model output")


def validate_roadmap(data: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(data, dict):
        raise ValueError("Roadmap is not an object")
    if not data.get("topic") or not isinstance(data["topic"], str):
        raise ValueError("Missing topic")
    roadmap = data.get("roadmap")
    if not isinstance(roadmap, list) or len(roadmap) == 0:
        raise ValueError("Missing or empty roadmap array")

    for i, step in enumerate(roadmap):
        if not isinstance(step, dict):
            raise ValueError(f"Step {i} is not an object")
        for field in ["id", "title", "description", "duration"]:
            if not step.get(field):
                raise ValueError(f'Step {i} missing "{field}"')
        step["prerequisite_context"] = str(step.get("prerequisite_context") or "")

    return data


MAX_ATTEMPTS = 3


async def generate_roadmap(topic: str) -> dict[str, Any]:
    if not topic or not isinstance(topic, str) or not topic.strip():
        raise ValueError("topic must be a non-empty string")

    cfg = get_llm_config()
    model_name = cfg.model or "primary_model"

    prompt_text = build_user_prompt(topic)
    last_error = None
    raw_text = ""

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            raw_text = await complete(prompt_text, system_prompt=SYSTEM_PROMPT)
            parsed = extract_json(raw_text)
            validated = validate_roadmap(parsed)
            return {
                "data": validated,
                "provider": model_name
            }
        except Exception as err:
            last_error = err
            logger.warning("[Primary Model: %s] Attempt %d failed: %s", model_name, attempt, err)
            prompt_text = build_repair_prompt(raw_text, str(err))

    # Error handler if primary model fails after retries
    raise RuntimeError(
        f"Primary model '{model_name}' failed to generate valid roadmap: {last_error}"
    )
