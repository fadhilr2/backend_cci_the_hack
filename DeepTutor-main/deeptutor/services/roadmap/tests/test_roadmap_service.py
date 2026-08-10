import pytest
from deeptutor.services.roadmap.generator import (
    extract_json,
    validate_roadmap,
    generate_roadmap,
    _get_api_key,
)

def test_extract_json():
    raw = '```json\n{"topic": "Python", "roadmap": [{"id": "1", "title": "Basics", "description": "Learn basics", "duration": "1 week", "prerequisite_context": ""}]}\n```'
    extracted = extract_json(raw)
    assert extracted["topic"] == "Python"
    validated = validate_roadmap(extracted)
    assert len(validated["roadmap"]) == 1

def test_extract_json_markdown_variations_and_repair():
    # Uppercase tag and trailing commentary
    raw = '```JSON\n{"topic": "Math", "roadmap": [{"id": "1", "title": "Algebra", "description": "Basics", "duration": "3 days"}]}\n```\nHere is your output'
    extracted = extract_json(raw)
    assert extracted["topic"] == "Math"

    # Trailing comma repaired by json_repair
    raw_broken = '{"topic": "Physics", "roadmap": [{"id": "1", "title": "Forces", "description": "Newton", "duration": "1 week",}],}'
    extracted_broken = extract_json(raw_broken)
    assert extracted_broken["topic"] == "Physics"

def test_validate_roadmap_normalization_and_errors():
    # Missing prerequisite_context should be normalized to ""
    sample = {
        "topic": "CS",
        "roadmap": [{"id": "1", "title": "DSA", "description": "Algo", "duration": "2 weeks"}],
    }
    val = validate_roadmap(sample)
    assert val["roadmap"][0]["prerequisite_context"] == ""

    # Missing topic
    with pytest.raises(ValueError, match="Missing topic"):
        validate_roadmap({"roadmap": []})

    # Missing step field
    with pytest.raises(ValueError, match='Step 0 missing "title"'):
        validate_roadmap({"topic": "AI", "roadmap": [{"id": "1", "description": "x", "duration": "1d"}]})

def test_generate_roadmap_input_validation():
    with pytest.raises(ValueError, match="non-empty string"):
        generate_roadmap("")
    with pytest.raises(ValueError, match="non-empty string"):
        generate_roadmap("   ")

def test_get_api_key():
    gemini_key = _get_api_key("GEMINI_API_KEY")
    assert isinstance(gemini_key, str)
    openrouter_key = _get_api_key("OPENROUTER_API_KEY")
    assert isinstance(openrouter_key, str)

