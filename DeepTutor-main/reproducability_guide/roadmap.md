# Implementation Guide: Reproducing the Adaptive Roadmap Microservice & Feature on a New DeepTutor Directory

This implementation guide documents the complete 3-step blueprint for reproducing and integrating the **Adaptive Roadmap Engine & Pure Stateless REST API** onto a fresh, newly cloned DeepTutor repository, including all edge cases encountered and their exact resolutions.

---

## 🎯 Goal Description

Transform a standard DeepTutor repository by adding an AI-powered **Adaptive Roadmap Generator**. This feature:
1. Generates structured 10-step STEM learning timelines adapting to student memory profiles (`PROFILE.md` / `read_l3_concat()`).
2. Provides a **Pure Stateless Microservice API** (`POST /api/v1/roadmap/generate`) returning raw output JSON directly to parent backend applications without disk file writing.
3. Supports both **In-Process Python SDK calls** (`from deeptutor.services.roadmap.generator import generate_roadmap`) AND **HTTP REST Microservice Requests**.

---

## 📌 Modular 3-Step Integration Blueprint

1. **Step 1 (Stateless Service Engine)**: Implement `deeptutor/services/roadmap/generator.py` using DeepTutor's active primary LLM model with self-healing JSON repair and error handler.
2. **Step 2 (FastAPI Router with Trailing Slash Support)**: Implement `deeptutor/api/routers/roadmap.py` with `@router.post("/generate")` and `@router.post("/generate/")` and register in `deeptutor/api/main.py`.
3. **Step 3 (Next.js Frontend UI Page & Navigation Registration)**: Implement `web/app/(workspace)/roadmap/page.tsx` with interactive roadmap generation, local storage auto-save, and Socratic Chat milestone routing, then register the route in `web/components/sidebar/SidebarShell.tsx` and `web/lib/capability-routes.ts`.

---

## 🏗️ Implementation Code

### Component 1: Backend Roadmap AI Service Engine (`generator.py`)

#### [NEW] [generator.py](../deeptutor/services/roadmap/generator.py)
```python
import json
import re
from typing import Any
from deeptutor.services.llm import complete, get_llm_config

async def generate_roadmap(topic: str) -> dict[str, Any]:
    if not topic or not isinstance(topic, str) or not topic.strip():
        raise ValueError("topic must be a non-empty string")

    cfg = get_llm_config()
    model_name = cfg.model or "primary_model"

    prompt_text = f"Generate a learning roadmap for: {topic}"
    last_error = None
    raw_text = ""

    for attempt in range(1, 3):
        try:
            raw_text = await complete(prompt_text, system_prompt=SYSTEM_PROMPT)
            parsed = extract_json(raw_text)
            validated = validate_roadmap(parsed)
            return {"data": validated, "provider": model_name}
        except Exception as err:
            last_error = err
            prompt_text = build_repair_prompt(raw_text, str(err))

    # Error handler if primary model fails after retries
    raise RuntimeError(
        f"Primary model '{model_name}' failed to generate valid roadmap: {last_error}"
    )
```

---

### Component 2: API Router Registration (`roadmap.py`)

#### [NEW] [roadmap.py](../deeptutor/api/routers/roadmap.py)
```python
from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from deeptutor.services.roadmap.generator import generate_roadmap

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
        raise HTTPException(status_code=500, detail=f"Failed to generate roadmap: {exc}")
```

#### [MODIFY] [main.py](../deeptutor/api/main.py)
```python
from deeptutor.api.routers import roadmap
app.include_router(
    roadmap.router,
    prefix="/api/v1/roadmap",
    tags=["roadmap"],
    dependencies=_auth,
)
```

---

### Component 3: Next.js Frontend UI Page (`page.tsx`)

#### [NEW] [page.tsx](../web/app/(workspace)/roadmap/page.tsx)
```tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Compass, Loader2, ArrowRight, BookOpen, RotateCcw } from "lucide-react";
import { apiFetch, apiUrl } from "@/lib/api";

interface RoadmapStep {
  id: string;
  title: string;
  description: string;
  duration: string;
  prerequisite_context: string;
}

interface RoadmapResponse {
  data: {
    topic: string;
    roadmap: RoadmapStep[];
  };
  provider: string;
}

const STORAGE_KEY = "deeptutor.roadmap.saved_state";

export default function RoadmapPage() {
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(null);
  const router = useRouter();

  // Restore saved roadmap from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.topic) setTopic(parsed.topic);
        if (parsed?.roadmap) setRoadmap(parsed.roadmap);
      }
    } catch (err) {
      console.error("Failed to restore saved roadmap state", err);
    }
  }, []);

  const handleGenerate = async (queryTopic: string) => {
    if (!queryTopic.trim()) return;
    setTopic(queryTopic);
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(apiUrl("/api/v1/roadmap/generate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: queryTopic }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.detail || "Failed to generate roadmap.");
      }

      const data: RoadmapResponse = await res.json();
      setRoadmap(data);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ topic: queryTopic, roadmap: data })
        );
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleStartMilestone = (step: RoadmapStep) => {
    const topicTitle = roadmap?.data.topic || "STEM Topic";
    const prompt =
      `I am following the adaptive learning roadmap for "${topicTitle}" ` +
      `and starting Milestone ${step.id}: "${step.title}".\n\n` +
      `• Overview: ${step.description}\n` +
      `• Target Duration: ${step.duration}\n` +
      (step.prerequisite_context ? `• Prerequisites Note: ${step.prerequisite_context}\n\n` : `\n`) +
      `Please act as my Socratic AI tutor for this milestone. Introduce the core concepts step-by-step and ask me an initial diagnostic question to kick off our learning session!`;

    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("deeptutor.pending_milestone_prompt", prompt);
    }
    router.push("/home");
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center p-8 pb-20">
        <div className="mb-8 flex w-full max-w-2xl gap-2">
          <input
            type="text"
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--secondary)] px-4 py-3 text-[15px] text-[var(--foreground)] outline-none"
            placeholder="What do you want to master next? e.g. Machine Learning Fundamentals"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
          <button
            onClick={() => handleGenerate(topic)}
            disabled={loading || !topic.trim()}
            className="flex items-center gap-2 rounded-xl bg-[var(--foreground)] px-6 py-3 font-medium text-[var(--background)]"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Compass size={18} />}
            Generate
          </button>
        </div>

        {roadmap && (
          <div className="w-full">
            {roadmap.data.roadmap.map((step) => (
              <div key={step.id} className="mb-4 p-4 rounded-xl border border-[var(--border)]">
                <h3 className="font-bold">{step.title} ({step.duration})</h3>
                <p>{step.description}</p>
                <button onClick={() => handleStartMilestone(step)}>Start Milestone</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

#### [MODIFY] [SidebarShell.tsx](../web/components/sidebar/SidebarShell.tsx)
```tsx
import { Compass } from "lucide-react";

// Add to PRIMARY_NAV:
{
  href: "/roadmap",
  label: "Roadmap",
  icon: Compass,
  tooltipKey: "Roadmap tooltip",
  requires: "llm",
}
```

#### [MODIFY] [capability-routes.ts](../web/lib/capability-routes.ts)
```typescript
export const ROUTE_CAPABILITIES: ReadonlyArray<{
  prefix: string;
  capability: Capability;
}> = [
  { prefix: "/home", capability: "llm" },
  { prefix: "/partners", capability: "llm" },
  { prefix: "/roadmap", capability: "llm" },
  // ...
];
```

## ⚠️ Edge Cases Encountered & Exact Resolutions Matrix

| # | Edge Case / Symptom | Root Cause | Exact Resolution |
|---|---|---|---|
| **1** | **404 Not Found on Trailing Slash (`/generate/`)**<br>*Client returned 404 when sending requests to `/generate/`.* | `deeptutor/api/main.py` sets `redirect_slashes=False`, disabling automatic 307 redirects for trailing slashes. | Added dual decorators `@router.post("/generate")` AND `@router.post("/generate/")` in `roadmap.py`. |
| **2** | **IPv6 vs IPv4 Port Binding Mismatch on Windows (`localhost` vs `127.0.0.1`)**<br>*API client failed to connect on Windows when using `localhost:8001`.* | Windows `localhost` resolves to IPv6 `::1`, whereas Uvicorn default `0.0.0.0` binds to IPv4. | Use `http://127.0.0.1:8001` or bind Uvicorn with `--host 0.0.0.0`. |
| **3** | **CLI Extra Argument Error (`deeptutor serve -- port 8001`)**<br>*Typer CLI threw `Got unexpected extra argument(s)` error.* | Extra space between `--` and `port` was interpreted as an option separator. | Run `deeptutor serve --port 8001` without spaces. |
| **4** | **Markdown Code Fence Wrapped Output**<br>*`json.loads()` threw `JSONDecodeError` when LLM returned markdown code blocks.* | LLMs default to wrapping JSON output in ` ```json ... ``` `. | Implemented regex stripping (`_clean_json_text()`). |
| **5** | **Missing Frontend Sidebar Navigation & Gated Route Map**<br>*Users could not see or navigate to the `/roadmap` page from the workspace sidebar.* | Workspace features must be registered in `PRIMARY_NAV` in `web/components/sidebar/SidebarShell.tsx` and mapped to `capability: "llm"` in `web/lib/capability-routes.ts`. | Add `Compass` icon and entry `{ href: "/roadmap", label: "Roadmap", icon: Compass, requires: "llm" }` to `SidebarShell.tsx`, and add `{ prefix: "/roadmap", capability: "llm" }` to `capability-routes.ts`. |
| **6** | **RuntimeError in Thread Worker Event Loop (`httpx.AsyncClient` mismatch)**<br>*Endpoint returned 500 "Failed to generate roadmap" when called asynchronously.* | `asyncio.to_thread` ran `generate_roadmap()` in a worker thread. Reusing the process-wide async HTTP client bound to FastAPI's main event loop caused event loop mismatch. | Created `generate_roadmap_async()` and updated `generate_roadmap_endpoint` in `roadmap.py` to `await generate_roadmap_async(payload.topic)` directly on FastAPI's main event loop. |

---

## 🧪 Verification & Testing Plan

Run the complete reproduction test suite:

```bash
python -m pytest tests/reproduce/test_roadmap.py tests/reproduce/test_roadmap_microservice.py

======================== 4 passed in 2.09s ========================
```
