# Full Project Audit — Najmah / Starry Tales

Produce a single, evidence-based engineering audit document. No code changes, no new features.

## Deliverable

One file: `docs/PROJECT_FULL_AUDIT.md` (Arabic + English mixed, matching the report structure requested).
Nothing else in the repo is touched.

## How the report is built

Every claim comes from reading the actual code, not assumption:

- Routes and pages: read `src/App.tsx` (68 route entries) and all 72 files in `src/pages/`.
- Components: enumerate `src/components/` (60+ root files plus `admin/`, `story/`, `cart/`, `payment/`, `ui/`).
- Hooks and data layer: `src/hooks/`, `src/lib/`, `src/api/`, `src/integrations/supabase/`.
- Backend: 49 edge functions in `supabase/functions/`, plus the live database schema (69 tables, enums, RPC functions, RLS policies, storage buckets).
- Config: `vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`, `package.json`, `.env.example`, `supabase/config.toml`, `Dockerfile`, `docker-compose*.yml`, `.github/workflows/ci.yml`.
- Legacy stack: `backend-core/` (NestJS) and `ai-service/` (FastAPI) are assessed for whether they are still wired to the running app.

## Report sections

1. **Project Overview** — product purpose, commercial model (tiers, credits, Paddle + manual payments), user types (parent/child, editor, admin), main user flows traced through actual routes.
2. **Frontend Architecture** — React 18 / TS / Vite 5 / Tailwind / shadcn / TanStack Query / React Router / RHF+Zod / i18next (6 locales, RTL) / PWA; full annotated `src/` tree with the purpose of each folder.
3. **Pages Inventory** — table of every page: file, route, purpose, key components, completion status (complete / partial / legacy).
4. **Components Map** — grouped into layout, shared, feature (story, admin, cart, payment), and UI primitives, with the relationship graph between them.
5. **Data Layer** — Supabase client usage vs. the leftover `src/api/*` NestJS-era client, tables actually queried, auth flow via `useAuth`, storage buckets and their public/private state, external services.
6. **AI Features** — where AI is invoked (edge functions and client callers), the SEL 4-act pipeline stages, prompt locations, models used, request/response shapes, quota and moderation gates.
7. **Environment Configuration** — required variables by surface (frontend, edge functions, legacy services), config files, key dependencies, secret names only (never values).
8. **Security Review** — auth, RBAC via `user_roles` / `has_role`, RLS and grants coverage, edge-function auth checks, client-side exposure, current known gaps.
9. **Deployment Readiness** — local run commands, build process, required artifacts, and an honest verdict on portability outside Lovable (including the Lovable Cloud coupling points).
10. **Export Plan** — concrete steps for GitHub, local dev, Vercel/Netlify, and Docker, including what must be replaced (Cloud-managed backend, secrets, migrations).
11. **Final Assessment** — completion percentage per area, top current problems, top 10 pre-launch steps, and a recommendation on freezing vs. reworking the frontend.

## Technical notes

- Read-only work: file reads, searches, and read-only database queries. No migrations, no deploys, no edits outside the report file.
- Where evidence is inconclusive, the report marks it explicitly as "unverified" rather than guessing.
