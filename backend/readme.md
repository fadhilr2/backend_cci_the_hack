# DeepTutor Node.js Microservice Backend

This directory contains a **Node.js (ES Modules)** microservice backend for DeepTutor serving all REST and WebSocket endpoints specified in [`AGENTS.md`](../DeepTutor-main/AGENTS.md).

## 🚀 Getting Started

### 1. Installation

Install Node.js dependencies:

```bash
cd backend
npm install
```

### 2. Running the Server

Start the backend server on port `8000` (connecting to DeepTutor service on port `8001`):

```bash
# Production start
npm start

# Development mode (auto-reload)
npm run dev
```

---

## 📡 API Endpoints Summary

### 1. WebSocket Real-Time Socratic Chat
* **`WS /api/v1/ws`**: Real-time streaming WebSocket endpoint for interactive Socratic chat, tool calls, and turn events.

### 2. Model Catalog & Profile Settings
* **`GET /api/v1/settings/catalog`**: Fetches current LLM, Embedding, and Search model profile settings.
* **`PUT /api/v1/settings/catalog`**: Updates model profiles and active bindings.

### 3. Adaptive STEM Roadmap Generator
* **`POST /api/v1/roadmap/generate`**: Generates personalized STEM learning timelines (`6 to 10` steps) for a given topic.

### 4. Course Tracking & Memory Pipeline
* **`POST /api/v1/courses/:course_id/track_video`**: Logs video watch events and knowledge concepts to L1 trace.
* **`POST /api/v1/courses/:course_id/quiz/evaluate`**: Evaluates MCQ & Essay responses, identifies distractor misconceptions, and emits to L1 trace.
* **`POST /api/v1/courses/:course_id/modules/:module_id/complete`**: Consolidates learned concepts and misconception summaries into capstone L1 trace events.

### 5. Knowledge Base (RAG) Subsystem
* **`GET /api/v1/knowledge/list`**: Lists all active Knowledge Bases.
* **`POST /api/v1/knowledge/create`**: Creates a new Knowledge Base repository.
* **`POST /api/v1/knowledge/:kb_name/documents/upload`**: Uploads textbook documents (PDF, DOCX, TXT) into a Knowledge Base.
* **`DELETE /api/v1/knowledge/:kb_name`**: Deletes a Knowledge Base.

### 6. Three-Layer Memory System (L1, L2, L3)
* **`GET /api/v1/memory/doc/:layer/:key`**: Retrieves a specific memory document.
* **`POST /api/v1/memory/doc/:layer/:key/reset`**: Resets or clears a memory document.
