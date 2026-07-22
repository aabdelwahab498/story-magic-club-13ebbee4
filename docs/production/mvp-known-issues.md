# Najmah MVP Known Issues & Risks

This document classifies known issues and technical debt discovered during the Sprint 10.1 MVP Production Readiness Audit.

## 1. Critical (Must fix before launch)
- **None Identified**: All core MVP user journeys (Authentication, Story Generation, Children Management) securely utilize the NestJS backend and correctly isolate user data.

## 2. High (Should fix before beta)
- **Supabase Environment Splitting**: The current `.env` defaults assume a single Supabase instance. Ensure Staging and Production are entirely separate Supabase projects to prevent test data from bleeding into production.
- **Billing Caps**: The FastAPI service does not currently enforce hard daily token limits per user at the API gateway layer. While there is a quota mechanism on the Supabase Edge Functions, this should be validated thoroughly to prevent runaway LLM costs.

## 3. Medium (Can defer)
- **Admin Monolith Legacy Code**: The frontend `Admin.tsx` dashboard and related admin routes still use direct Supabase queries (`supabase.from(...)`). While securely locked behind Supabase RLS (only Admins can query), it bypasses the NestJS architecture. This should be refactored in a future sprint.
- **WebSockets vs Polling**: The frontend uses short HTTP polling (`setInterval`) for `GET /stories/:id/status`. This is simple and reliable for MVP but will scale poorly with thousands of concurrent users. WebSockets or SSE should be considered for V2.

## 4. Low (Technical debt)
- **Error Granularity**: When the AI Gateway fails, it returns a generic 500 error to the frontend, marking the story status as `FAILED`. Enhancing this to inform the user *why* it failed (e.g., "Content safety violation" vs "Service timeout") would improve UX but is not strictly necessary for MVP.
- **Frontend Code Splitting Optimization**: While lazy loading is implemented, some chunks are slightly heavy. The Rollup build outputs minor warnings about chunk size limits, which can be optimized further in future updates.
