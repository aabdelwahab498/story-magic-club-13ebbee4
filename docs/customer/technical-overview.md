# Technical Overview (technical-overview.md)

This document provides a technical guide on system architecture, service components, and request lifecycles.

---

## 1. System Architecture
Najmah uses a decoupled, three-tier service architecture:
1. **Frontend Client (React SPA PWA):** Serves interactive layouts and caches server data using React Query. No direct DB connection is allowed.
2. **API Monolith Gateway (NestJS Core):** Orchestrates domain routing, authenticates calls via HttpOnly cookies, and performs DTO parameter validation.
3. **AI Microservice (FastAPI Python):** Composes generation prompts, verifies schema parsing, and manages Google Gemini API connections.
4. **Data & Storage (Supabase):** PostgreSQL database with active Row-Level Security (RLS) policies and secure S3 storage buckets.

---

## 2. Generation Request Lifecycle
1. The client dispatches a story generation POST request.
2. The NestJS API Gateway validates user limits, checks credit quotas, and creates a story request entry in PostgreSQL.
3. The request is dispatched via the `JobDispatcher` interface.
4. The job handler calls the FastAPI microservice to plan and write the story.
5. The output story is evaluated against the `18/25` quality score and safety checks.
6. The final story is stored in Supabase, and credits are deducted.
7. The gateway returns the story, and the client renders the pages and illustrations.
