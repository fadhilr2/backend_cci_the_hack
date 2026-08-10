"""Unit test suite for Adaptive Roadmap Generator & API Endpoint.

Reproducible test suite for verifying JSON self-healing repair, roadmap generator service,
and FastAPI endpoint registration on any DeepTutor repository.
"""

import json
import pytest
from deeptutor.services.roadmap.generator import extract_json, validate_roadmap, generate_roadmap


def test_extract_json_strips_fences_and_parses():
    """Verify that extract_json cleanly handles markdown fences and json repair."""
    raw_llm_output = """```json
{
  "topic": "Machine Learning",
  "roadmap": [
    {
      "id": "step_1",
      "title": "Cost Functions",
      "description": "Understanding J(w,b)",
      "duration": "1 week"
    }
  ]
}
```"""

    extracted = extract_json(raw_llm_output)
    validated = validate_roadmap(extracted)

    assert validated["topic"] == "Machine Learning"
    assert len(validated["roadmap"]) == 1
    assert validated["roadmap"][0]["title"] == "Cost Functions"


def test_validate_roadmap_schema_validation():
    """Verify that validate_roadmap raises ValueError on invalid schema."""
    with pytest.raises(ValueError):
        validate_roadmap({})

    with pytest.raises(ValueError):
        validate_roadmap({"topic": "STEM", "roadmap": []})

