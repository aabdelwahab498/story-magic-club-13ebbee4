# Changelog

All notable changes to the Najmah AI Platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-22

### Added
- **Authentication**: Modernized user authentication utilizing `HttpOnly` cookies and strict NestJS guards.
- **Child Profiles**: Domain management for children profiles with age-appropriate vocabulary, languages, and SEL goals.
- **Story Generation**: AI storyteller flow generating personalized blueprints and 4-act stories via the Hybrid AI Gateway.
- **Hybrid AI Gateway**: Resilient FastAPI integration enabling fast generation and fallback logic between multiple LLM providers (Google Gemini / OpenAI).
- **Story Library**: Centralized gallery of user-generated stories with multi-child filtering and offline PWA precache.
- **Story Reader MVP**: High-fidelity reading experience featuring dynamic font scaling, precise RTL (Arabic) rendering, chapter navigation, and audio sync.
- **Export Center & Customer Download Experience**: Added PDF, MP3 narration audio, and dynamic ZIP bundle exports featuring cover pages, page numbers, `metadata.json`, and branding footers.

### Optimized (Performance & Hardening)
- **Database Query Consolidation**: Reduced subscription verification sequence from 6 queries to 2 queries using JOIN constructs (~77% latency reduction).
- **Frontend Code Splitting**: Implemented Rollup manual chunks in `vite.config.ts` to separate vendor packages, reducing the main app bundle from 995 kB to **260 kB** (~74% size reduction).
- **Startup Diagnostics**: Added automated startup check validations verifying environment variables, Postgres socket health, and FastAPI AI provider endpoints.
- **Job Abstraction Layer**: Added generic dispatcher and handler interfaces (`JobDispatcher`, `JobHandler`), preparing the platform for asynchronous BullMQ and Redis queues without core service code refactoring.

### Security
- Shifted all direct frontend-to-database requests into a secure backend REST implementation.
- Enforced HttpOnly session cookies across the application (bypassing legacy local storage JWT vulnerabilities).
- Re-architected backend API endpoints behind strong parameter validation and global exception filters.
- Sanitized loggers to automatically scrub passwords, tokens, API keys, and PII from stdout streams.

### Infrastructure & Observability
- Decoupled the repository into an orchestration-first pattern: React SPA `->` NestJS Gateway `->` FastAPI Microservice.
- Integrated Pino JSON structured logs and Prometheus metric scrapers tracing API durations, SQL speeds, and AI processing times.
- Exposed `/api/v2/health/live` and `/api/v2/health/ready` endpoints for automated container orchestration.
