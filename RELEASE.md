# Najmah v1.0.0 Production Release Notes (RELEASE.md)

**Release Version:** `Najmah v1.0.0`
**Release Date:** July 22, 2026
**Target Architecture:** Three-tier (React 18 SPA + NestJS 10 Gateway + FastAPI Python Microservice + Supabase Postgres)

---

## 1. Features Included

* **4-Act SEL Story Engine:** Deterministic story blueprints tailored to target age groups and Social-Emotional Learning (SEL) goals.
* **Multilingual Generation:** Full support for 6 locales (`en`, `ar`, `de`, `fr`, `it`, `es`) with native right-to-left (RTL) layout rendering.
* **Multimodal Generation:** Automated Character Bible extraction, scene illustrations, and stitched synthetic voice narrations.
* **Customer Export Center:** Instant export of personalized stories into print-ready PDF books, MP3 narration audio files, and dynamic ZIP bundles (`story.pdf`, `story.mp3`, `cover.png`, `page-1.png`...`page-N.png`, `metadata.json`).
* **Authentication & RBAC:** Security using `HttpOnly` session cookies, NestJS Auth Guards, and database Row-Level Security (RLS).
* **DevOps Infrastructure:** Multi-stage production `Dockerfile`s, `docker-compose.yml`, `docker-compose.production.yml`, NGINX reverse proxy with gzip & security headers, and automated backup/restore scripts (`scripts/backup-database.sh`).
* **Observability:** Pino JSON structured logs, health check probes (`/api/v2/health/ready`), and Prometheus metric scrapers.

---

## 2. Technical Stack Summary

* **Frontend SPA:** React 18, Vite 5, Tailwind CSS 3, shadcn/ui, TanStack Query v5, i18next, PWA precache.
* **Backend API Gateway:** NestJS 10, Zod / Class-Validator, Pino Logger, Prometheus metrics.
* **AI Service:** FastAPI, Python 3.11, Pydantic v2, Google Gemini API SDK.
* **Data & Storage:** Supabase PostgreSQL, Row-Level Security, Supabase S3 Buckets (`pdf_exports`, `audio`, `illustrations`).

---

## 3. Known Limitations

* **Synchronous Long-Running AI Generation:** Currently, story generation requests complete synchronously via REST gateway timeouts. (Job abstraction layers `JobDispatcher` have been introduced to easily shift to BullMQ/Redis worker queues in future scaling iterations).
* **PDF Font Embedding for Complex Scripts:** Dynamic PDF compilation embeds standard UTF-8 font subsets; complex right-to-left font glyphs render cleanest when using standard system font fallbacks.

---

## 4. Future System Roadmap

* **Phase 10 Scaling:** Redis & BullMQ worker queue integration for asynchronous background story generation.
* **PgBouncer Integration:** Database connection pooling for high-concurrency transactional spikes.
* **Multi-LLM Dynamic Load Balancing:** Automatic real-time fallback routing across Gemini, Claude, and OpenAI GPT-4o based on provider latencies.
