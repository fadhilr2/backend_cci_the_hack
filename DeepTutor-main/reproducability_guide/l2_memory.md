# Implementation Guide: Reproducing the Resilient L2 Memory System on a New DeepTutor Directory

This implementation guide documents the complete 6-step blueprint for reproducing and integrating the **Resilient L2 Memory System & High-Density Consolidation Engine** onto a fresh, newly cloned DeepTutor repository, including all edge cases encountered and their exact resolutions.

---

## 🎯 Goal Description

Transform a standard DeepTutor repository by upgrading its **L2 Memory System & Line-Doc Consolidation Engine**. This upgrade:
1. Eliminates memory edit rejections (`replace requires non-empty refs`, `line X is not an editable entry`, `entry not found in current doc`).
2. Prevents duplicate bullet entries (`completed Video 1.1...`) and double-bullet visual artifacts (`•  •`).
3. Captures all virtual chat logs, video lectures, knowledge base concept tags, and course completion milestones into L2/L3 memory without prompt filter blockage.
4. Categorizes quiz attempts cleanly into **`Misconceptions`** (wrong distractor choices) and **`Strong topics`** (correct answers) with precise footnote citations (`quiz:course_cs101:q1_1_1`).
5. Auto-injects L3 memory profiles into the Chat Agent system prompt so asking *"Check my memory"* or *"What concept should I study next?"* instantly retrieves exact learning history.

---

## 📌 Modular 6-Step Integration Blueprint

1. **Step 1 (Resilient Line Engine)**: Modify `deeptutor/services/memory/consolidator/line_doc.py` to add ref inheritance, line snapping ($\pm 1..3$), bullet stripping, duplicate prevention, and entry recovery.
2. **Step 2 (Atomic Ops Deduplication)**: Update `deeptutor/services/memory/ops.py` to check for text duplicates in `AddOp`.
3. **Step 3 (Quiz Surface Section Definitions)**: Update `deeptutor/services/memory/consolidator/prompts/en/_meta.yaml` to include `"Misconceptions"` in `quiz` surface sections.
4. **Step 4 (High-Density L2 Consolidation Prompt Rules)**: Update `deeptutor/services/memory/consolidator/prompts/en/update_l2.yaml` with explicit quiz & course log extraction rules and remove rigid banned word filters.
5. **Step 5 (Relaxed L3 Synthesis Prompt Rules)**: Update `deeptutor/services/memory/consolidator/prompts/en/update_l3.yaml` to allow natural executive claim formatting.
6. **Step 6 (Always-On System Prompt Memory Injection)**: Update `deeptutor/services/session/turn_runtime.py` and `deeptutor/agents/chat/prompts/en/agentic_chat.yaml` to auto-load L3 memory profiles into every chat turn.

---

## 🏗️ Proposed Changes

### Component 1: Resilient Line Engine (`line_doc.py`)

#### [MODIFY] [line_doc.py](../deeptutor/services/memory/consolidator/line_doc.py)

#### 1. Leading Bullet Stripper Helper
Strip leading bullet symbols (`•`, `-`, `*`, `·`, `▪`) from LLM text outputs to prevent double bullet (`•  •`) rendering in markdown:

```python
def _clean_entry_text(text: str) -> str:
    cleaned = text.strip()
    for _ in range(4):
        prev = cleaned
        cleaned = cleaned.lstrip("•-*·▪ \t")
        if cleaned == prev:
            break
    return cleaned
```

#### 2. Ref Inheritance, Smart Line Snapping, & Entry Recovery in `_apply_replace`
```python
def _apply_replace(edit: ReplaceLineOp, doc: Document, view: LineView) -> str:
    target_line_num = max(1, min(len(view.lines), edit.line)) if view.lines else edit.line
    line = view.line(target_line_num)
    if line is None or line.kind != "bullet" or not line.entry_id:
        snapped = None
        for offset in (1, -1, 2, -2, 3, -3):
            cand = view.line(target_line_num + offset)
            if cand and cand.kind == "bullet" and cand.entry_id:
                snapped = cand
                break
        if snapped:
            line = snapped
        else:
            raise _Reject(f"line {edit.line} is not an editable entry")

    if not edit.new_text.strip():
        raise _Reject("new_text empty")

    entry = _entry_in_doc(doc, line.entry_id)
    if entry is None:
        target_section = line.section or "Mastery"
        refs = list(edit.refs) if edit.refs else []
        if not refs:
            all_refs = [r for e in doc.all_entries() for r in e.refs if r]
            refs = [all_refs[0]] if all_refs else ["chat:system"]
        entry = Entry(
            id=line.entry_id or new_entry_id(),
            section=target_section,
            text=_clean_entry_text(edit.new_text),
            refs=refs,
        )
        _section_entries(doc, target_section).append(entry)
        return f"recovered entry {entry.id}"

    entry.text = _clean_entry_text(edit.new_text)
    if edit.refs:
        entry.refs = list(edit.refs)
    elif not entry.refs:
        all_refs = [r for e in doc.all_entries() for r in e.refs if r]
        if all_refs:
            entry.refs = [all_refs[0]]
        else:
            raise _Reject("replace requires non-empty refs")
    return f"replace {entry.id}"
```

---

### Component 2: Quiz Surface Definitions (`_meta.yaml`)

#### [MODIFY] [_meta.yaml](../deeptutor/services/memory/consolidator/prompts/en/_meta.yaml)
Add `Misconceptions` to `quiz` surface section options:

```yaml
  quiz:
    focus: "Identified misconceptions, error patterns across quiz attempts, topics with low/high success rate, and item types the user struggles with."
    sections: ["Misconceptions", "Error patterns", "Struggling topics", "Strong topics"]
```

---

### Component 3: High-Density L2 Consolidation Prompt Rules (`update_l2.yaml`)

#### [MODIFY] [update_l2.yaml](../deeptutor/services/memory/consolidator/prompts/en/update_l2.yaml)
Add explicit rules for quiz surface to prevent miscategorizing correct answers under misconceptions:

```yaml
system: |
  You are the memory curator for DeepTutor user {user_label}.

  ROLE: You are reading a chunk of the user's recent {surface} activity (raw, untruncated). Extract ALL meaningful facts, user learning progress, completed modules, video completions, diagnostic test results, knowledge concepts, and misconceptions.

  OUTPUT: A single JSON object — nothing else, no prose, no fences.

      {{"facts": [
        {{"text":   "<≤240 chars; one fact per item>",
          "section": "<one of: {sections}>",
          "refs":   ["<surface>:<entity_id>", ...]}}
      ]}}

  HARD RULES
  - Every fact must have ≥1 ref. Each ref must come from the "Chunk-local citeable refs" list or "@entity <surface>:<id>" markers in the chunk below.
  - BE MAXIMALLY COMPREHENSIVE AND GRANULAR! Extract MULTIPLE distinct facts per event/turn.
  - FOR QUIZZES & DIAGNOSTICS:
    1. Under "Misconceptions": Record ONLY items answered INCORRECTLY or identified conceptual misunderstandings (e.g. "thought parameters w,b control dataset sizing rather than line slope/intercept"). NEVER put correct answers under Misconceptions!
    2. Under "Strong topics": Record items answered CORRECTLY (e.g. "correctly answered question on parameter optimization").
    3. Under "Struggling topics": Record essay feedback or low-scoring items.
  - FOR COURSE EVENTS & VIRTUAL CHATS:
    1. Under "Topics": Extract the exact video/module completion (e.g. "completed Video 1.1: Model Representation & Cost Function in Course CS101").
    2. Under "Mastery": Extract EACH knowledge base concept and its core definition (e.g. "mastered Cost Function J(w,b): measures mean squared error between predictions and targets").
  - text ≤ 240 chars. Be descriptive, granular, and clear.
  - Surface focus: {focus}.

  Today is {today}.
```

---

### Component 4: Relaxed L3 Synthesis Prompt Rules (`update_l3.yaml`)

#### [MODIFY] [update_l3.yaml](../deeptutor/services/memory/consolidator/prompts/en/update_l3.yaml)
Relax L3 template constraints to allow rich executive claim formatting:

```yaml
system: |
  You are the cross-surface memory curator for DeepTutor user {user_label}.

  ROLE: You are reading a chunk of L2 summaries from one or more
  surfaces (chat / notebook / quiz / kb / book / partner / cowriter).
  Synthesize comprehensive, rich claims about the user's progress, mastered concepts, and misconceptions.

  OUTPUT: A single JSON object — nothing else.

      {{"facts": [
        {{"text":   "<≤240 chars; clear statement of concept/progress>",
          "section": "<one of: {sections}>",
          "refs":   ["<surface>", ...]}}
      ]}}

  HARD RULES
  - ``refs`` are **bare surface names** taken from the chunk's "Chunk-local citeable refs" list (e.g. ``chat``, ``quiz``).
  - text ≤ 240 chars. Be descriptive, natural, and comprehensive.
  - Slot focus: {focus}.

  Today is {today}.
```

---

### Component 5: Always-On System Prompt Memory Injection

#### [MODIFY] [turn_runtime.py](../deeptutor/services/session/turn_runtime.py)
Unconditionally load the user's compiled L3 profile into `memory_context`:

```python
# deeptutor/services/session/turn_runtime.py
memory_store = get_memory_store()
memory_context = memory_store.read_l3_concat()  # Always load L3 memory profile!
```

---

## ⚠️ Edge Cases Encountered & Exact Resolutions Matrix

| # | Edge Case / Symptom | Root Cause | Exact Resolution |
|---|---|---|---|
| **1** | **Course Log & Virtual Chat Extraction Skipped**<br>*L2 memory ignored completed video lectures and knowledge concept tags in `course_cs101`.* | Consolidator prompts contained rigid `Banned absolutist phrasing: ... mastered ...` rules, causing LLMs to drop course logs containing `"Mastered Knowledge Base Concepts"`. | Updated `update_l2.yaml` and `update_l3.yaml` to explicitly instruct the LLM to capture all virtual chat logs, video completions, and knowledge base concept tags into `Topics`, `Mastery`, and `Misconceptions`. |
| **2** | **Duplicate Bullet Entries (`completed Video 1.1...` repeated)**<br>*Identical bullet lines appeared multiple times in `chat.md`.* | Append ops during update passes did not check if an identical text entry already existed in the section. | Added text deduplication checks in `ops.py` (`AddOp`) and `line_doc.py` (`_apply_insert`). |
| **3** | **Missing Entry Warning Rejection (`replace L19 - entry not found`)**<br>*Line replacement failed when targeting an entry deleted in an earlier pass.* | `_apply_replace` threw `_Reject("entry not found")` when entry lookup failed. | Updated `_apply_replace` to gracefully create and recover missing target entries in place. |
| **4** | **L2 Fact Rejections (`replace requires non-empty refs`)**<br>*Facts dropped during L2/L3 consolidation.* | `line_doc.py` rejected replacement edits whenever the consolidator LLM omitted the `refs` array in its JSON payload. | Implemented automatic ref inheritance in `_apply_replace` and `_apply_insert` to retain existing citation refs. |
| **5** | **Targeting Section Headers (`line X is not an editable entry`)**<br>*Edits rejected when LLM targeted `## Mastery` lines.* | The line-numbered view rendered section headers as line items, causing LLMs to select header line numbers. | Added smart line snapping ($\pm 1..3$ radius search) in `line_doc.py` to auto-map edits to the nearest bullet entry. |
| **6** | **Double Bullet Rendering (`•  •`)**<br>*Consolidated memory items displayed redundant bullet points.* | LLMs emitted text starting with `•` or `-`, while document serialization prepends a bullet character. | Added `_clean_entry_text()` lstrip filter (`"•-*·▪ \t"`) before setting `entry.text`. |
| **7** | **Chat Agent Replied "I don't have access to past history"**<br>*Asking "check my memory" yielded generic answers.* | `turn_runtime.py` evaluated `memory_context = read_l3_concat() if memory_references else ""` — setting context to `""` for standard chat turns. | Changed `turn_runtime.py` to always load `memory_context = memory_store.read_l3_concat()`. |
| **8** | **Correct Answers Placed Under Misconceptions / Fallback Footnotes (`chat:system`)**<br>*Consolidator placed correct answers under Misconceptions and fell back to `chat:system` refs.* | `_meta.yaml` omitted `Misconceptions` for `quiz` surface, and `update_l2.yaml` lacked explicit categorization rules for correct vs incorrect quiz choices. | Added `Misconceptions` to `_meta.yaml` for `quiz`, and added explicit prompt rules in `update_l2.yaml` forcing correct answers into `Strong topics` and wrong choices into `Misconceptions` with exact entity IDs. |

---

## 🧪 Verification & Testing Plan

### Automated Commands
1. **Verify Backend Import Load**:
   ```bash
   python -c "from deeptutor.api.main import app; print('L2 Memory system clean!')"
   ```
2. **Run Memory Line-Doc Edit Engine Test Suite**:
   ```bash
   python -m pytest tests/reproduce/test_l2_memory.py
   ```
