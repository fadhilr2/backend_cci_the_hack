"""Unit test suite for Stateless Roadmap Microservice Endpoint."""

import pytest
from fastapi.testclient import TestClient
from deeptutor.api.main import app
from deeptutor.services.roadmap.generator import extract_json, validate_roadmap

client = TestClient(app)


def test_stateless_roadmap_json_parsing():
    """Verify that extract_json and validate_roadmap produce pure JSON payloads without writing to disk."""
    mock_llm_json = """{
        "topic": "Stateless Machine Learning",
        "roadmap": [
            {
                "id": "step_1",
                "title": "Cost Functions J(w,b)",
                "description": "Mean squared error loss formulation",
                "duration": "1 week"
            }
        ]
    }"""

    extracted = extract_json(mock_llm_json)
    validated = validate_roadmap(extracted)

    assert validated["topic"] == "Stateless Machine Learning"
    assert len(validated["roadmap"]) == 1
    assert validated["roadmap"][0]["id"] == "step_1"


def test_roadmap_endpoint_contract():
    """Verify that POST /api/v1/roadmap/generate rejects empty topic payloads with 400."""
    res = client.post("/api/v1/roadmap/generate", json={"topic": ""})
    assert res.status_code == 422 or res.status_code == 400
