# GitHub Release Notes — Najmah AI Platform v1.0.0

**Release Tag:** `v1.0.0`
**Target Branch:** `main`
**Release Date:** July 22, 2026

---

## 🚀 Welcome to Najmah AI Platform v1.0.0!

We are thrilled to announce the official **v1.0.0 Production Release** of the Najmah AI Story Platform. Najmah is an enterprise-ready, multimodal AI storytelling platform that combines emotional growth frameworks (SEL), personalized narratives, synthetic voice narrations, scene illustrations, and dynamic PDF/ZIP exports.

---

## 🌟 Key Features & Highlights

### 1. Interactive Story Generation & SEL Framework
* **4-Act Story Planner:** Deterministic 4-act blueprints (Hero, Mentor, Companion, SEL outcome).
* **Multi-language Support:** Localized generation for 6 languages (`en`, `ar`, `de`, `fr`, `it`, `es`) with native RTL support.
* **Age-Appropriate Vocabulary:** Tailors story prose, length, and sentence complexity to the child's age group.

### 2. Microservice Architecture
* **NestJS API Gateway:** Centralized Monolith API handling authentication, RBAC authorization, credit limits, usage tracking, and Export Center execution.
* **FastAPI Python AI Microservice:** Resilient LLM microservice executing 4-act planner prompts, writer generators, and retry loops.
* **Supabase PostgreSQL & Storage:** Database enforced by Row-Level Security (RLS) policies and storage buckets (`pdf_exports`, `audio`, `illustrations`).

### 3. Customer Export Center
* **PDF Book Generator:** Dynamic PDF compilation with cover page, child name, title, date, page illustrations, page numbers, and `Najmah AI Story Platform` branding footer.
* **Audio MP3 Narration Export:** Instant signed download URLs for synthetic audio narration streams.
* **ZIP Bundle Packager:** Dynamic zip packaging containing `story.pdf`, `story.mp3`, `cover.png`, `page-1.png`...`page-N.png`, and `metadata.json`.

### 4. Performance & Enterprise Hardening
* **~74% Frontend Bundle Reduction:** Manual Rollup code-splitting reduced index bundle to **260 kB**.
* **~77% Database Speedup:** Consolidated 6 DB queries during story operations into 2 optimized SQL queries.
* **Startup Diagnostics:** Validates database, storage, and API connectivity at startup to fail-fast.
* **Observability:** Pino JSON structured logs and Prometheus metric scrapers tracing API durations, SQL speeds, and AI processing times.

---

## 📦 Migration Achievements & Architecture Transition
- Successfully migrated from direct client-to-Supabase connections to a secure NestJS API Monolith Gateway.
- Enforced `HttpOnly` `SameSite=Lax` `Secure` session cookies across all auth routes.
- Abstracted background task execution behind `JobDispatcher` interfaces, preparing the system for BullMQ/Redis horizontal scaling.

---

## 📝 Installation & Quickstart

```bash
# Clone the repository
git clone https://github.com/aabdelwahab498/story-magic-club.git
cd story-magic-club

# Start Backend Gateway
cd backend-core
npm install && npm run start:dev

# Start AI Service
cd ../ai-service
python -m venv venv && .\venv\Scripts\activate && pip install -r requirements.txt
python -m uvicorn app.main:app --reload

# Start Frontend Client
cd ..
npm install && npm run dev
```

---

## 🔒 Security & Verification
- All backend unit tests passed (`41 test suites, 222 tests`).
- All python microservice tests passed (`4 tests`).
- All React frontend unit tests passed (`15 test suites, 71 tests`).
- Zero hardcoded secrets, tokens, or private API keys committed.
