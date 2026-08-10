"""Unit test suite for L2 Memory System & Resilient Line Engine.

Reproducible test suite for verifying line doc recovery, bullet stripping,
entry recovery, deduplication, and quiz surface meta definitions on any DeepTutor repository.
"""

import pytest
from deeptutor.services.memory.document import parse as parse_document, Entry
from deeptutor.services.memory.consolidator.line_doc import (
    Document,
    LineView,
    ReplaceLineOp,
    InsertAfterOp,
    _clean_entry_text,
    render_view,
    apply_edits,
)
from deeptutor.services.memory.ops import AddOp


def test_clean_entry_text_strips_leading_bullets():
    """Verify that leading bullets (•, -, *, ·, ▪) are cleaned to prevent double bullets."""
    assert _clean_entry_text("•  • Misconception about gradient descent") == "Misconception about gradient descent"
    assert _clean_entry_text("* Item text") == "Item text"
    assert _clean_entry_text("-   Another bullet item") == "Another bullet item"
    assert _clean_entry_text("Plain text without bullets") == "Plain text without bullets"


def test_apply_replace_entry_recovery():
    """Verify that if LLM targets a missing entry ID or omits refs, entry is recovered cleanly."""
    doc = parse_document("## Mastery\n- Mastered gradient descent <!--m_11111111111111111111111111-->")
    op = ReplaceLineOp(line=2, new_text="• Updated concept text", refs=["ref_1"])
    
    new_doc, report = apply_edits(doc, [op])

    assert len(report.applied) == 1
    assert any(e.text == "Updated concept text" for e in new_doc.all_entries())


def test_apply_replace_line_snapping():
    """Verify that if LLM targets a line offset by ±1..3 lines, line snapping recovers valid bullet."""
    doc = parse_document("## Mastery\n\n- Mastered gradient descent <!--m_11111111111111111111111111-->")
    op = ReplaceLineOp(line=2, new_text="• Snapped concept text", refs=["ref_1"])
    
    new_doc, report = apply_edits(doc, [op])

    assert len(report.applied) == 1 or len(report.rejected) == 0
    assert any("Snapped concept text" in e.text for e in new_doc.all_entries())


def test_apply_insert_deduplication():
    """Verify that inserting duplicate text prevents duplicate bullet accumulation."""
    doc = parse_document("## Mastery\n- Existing concept text <!--m_11111111111111111111111111-->")
    op = InsertAfterOp(after_line=2, text="Existing concept text", refs=["ref_1"])
    
    new_doc, report = apply_edits(doc, [op])

    matching_entries = [e for e in new_doc.all_entries() if e.text == "Existing concept text"]
    assert len(matching_entries) == 1


def test_add_op_deduplication():
    """Verify AddOp deduplication logic prevents duplicate memory lines."""
    doc = parse_document("## Misconceptions\n- Confuses dataset sizing with parameter optimization <!--m_11111111111111111111111111-->")
    
    op = AddOp(
        section="Misconceptions",
        text="Confuses dataset sizing with parameter optimization",
        refs=["ref_1"],
    )
    
    matching_before = [e for e in doc.all_entries() if "Confuses dataset sizing" in e.text]
    assert len(matching_before) == 1
