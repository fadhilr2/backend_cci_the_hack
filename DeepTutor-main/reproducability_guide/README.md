# DeepTutor Reproducibility Guide Suite

Welcome to the **DeepTutor Reproducibility Guide Suite**. This folder contains standardized, self-contained implementation blueprints and unit test suites for transporting, rebuilding, and verifying DeepTutor's core AI microservice features on any fresh DeepTutor repository.

---

## 📂 Standardized Suite Index

Every guide follows the exact same 4-part structure:
1. 🎯 **Goal Description**: AI microservice capabilities & stateless scope.
2. 📌 **Modular Integration Blueprint**: Detailed code snippets for Service Engine, FastAPI Backend Router, and Next.js Frontend Page.
3. ⚠️ **Edge Cases Encountered & Exact Resolutions Matrix**: Known gotchas, trailing slash fixes, and port handling.
4. 🧪 **Verification & Testing Plan**: Automated Pytest execution commands.

| # | Guide File | Description | Portable Unit Test Suite |
|---|---|---|---|
| 1 | **[`l2_memory.md`](l2_memory.md)** | **Resilient L2 Memory System**: Line engine ref inheritance, line snapping ($\pm 1..3$), bullet stripping, text deduplication, and zero-prompt chat memory injection. | `tests/reproduce/test_l2_memory.py` |
| 2 | **[`roadmap.md`](roadmap.md)** | **Adaptive Roadmap Microservice Engine**: Pure stateless REST API (`POST /api/v1/roadmap/generate`), primary LLM model integration with self-healing JSON repair, and Next.js frontend viewer. | `tests/reproduce/test_roadmap.py` & `test_roadmap_microservice.py` |
| 3 | **[`course_tracking.md`](course_tracking.md)** | **Specialized Course Assessment Engine**: Deterministic MCQ misconception mapping, AI LLM essay evaluator, video telemetry, and Next.js course viewer. | `tests/reproduce/test_course_tracking.py` |

---

## 🚀 How to Use on a New DeepTutor Repository

1. Copy the `reproducability_guide/` folder AND `tests/reproduce/` folder into your target repository.
2. Instruct your backend developer or AI coding agent:
   > *"Read the guides in `reproducability_guide/`, implement the code, and run `pytest tests/reproduce/`."*
3. Execute the automated test command:
   ```bash
   python -m pytest tests/reproduce/
   ```
4. When all **13 unit tests** pass, your new repository is 100% fully rebuilt, verified, and ready for production!
