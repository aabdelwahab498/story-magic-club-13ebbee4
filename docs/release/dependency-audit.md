# Najmah MVP v1.0 Dependency Audit

As part of the Sprint 10.2 MVP freeze, all primary dependencies across the system have been audited for stability and security. No major version bumps will be executed in this sprint to ensure the frozen baseline remains definitively stable.

## Frontend Dependencies (`package.json`)
- **React**: `^18.3.1` (Stable ecosystem foundation).
- **Vite**: `^5.4.1` (Current standard for modern SPA bundling).
- **Tailwind CSS**: `^3.4.11` (Stable layout engine).
- **TanStack Query (React Query)**: `^5.56.2` (Modern caching standard).
- **Supabase JS**: `^2.108.2` (Locked version guaranteeing current Auth behaviors).
- **Zod**: `^3.23.8` (Provides robust validation schemas without major unpatched vulnerabilities).

## Backend Dependencies (`backend-core/package.json`)
- **NestJS**: `^10.0.0` (Core framework operating on standard LTS nodes).
- **TypeScript**: `^5.1.3` (Strict mode validation intact).
- **Supabase JS**: Matches the frontend to prevent divergent API handling of JWTs and DTO mapping.

## AI Service Dependencies (`ai-service/requirements.txt`)
- **FastAPI**: Handling all high-throughput HTTP AI generation logic asynchronously.
- **Pydantic**: Critical for structural mapping of OpenAI/Gemini responses into guaranteed JSON blueprints.
- **OpenAI / Google-GenerativeAI**: Kept at currently stable REST API target SDKs.

## Security Overview
- **Vulnerabilities**: An `npm audit` run across the backend and frontend identified no `Critical` or `High` CVEs impacting production pathways.
- **Unused Packages**: Future cleanup sprints may drop the `jspdf` and `docx` packages from the frontend, as PDF and offline exporting have been scoped out of the MVP to be handled gracefully on the backend.
