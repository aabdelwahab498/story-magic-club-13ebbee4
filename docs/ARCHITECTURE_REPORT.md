# Najmah AI Story Platform – Architecture Report

---

## 1. Architecture Overview

### Frontend
- **Framework:** React 18 with TypeScript, built with Vite 5 (SWC). 
- **UI:** Tailwind CSS 3 + shadcn/ui primitives, dark/light mode via CSS variables, RTL support via `rtl:` utilities. 
- **State & Data:** TanStack Query v5 for server data, React Context for global state (auth, subscription). 
- **Routing:** React‑Router v7 with lazy‑loaded routes for admin, story, and public pages. 
- **Forms:** React‑Hook‑Form + Zod for validation. 
- **i18n:** i18next/react‑i18next with JSON locale files for EN, AR, DE, FR, IT, ES. 
- **PWA:** Workbox service worker, offline caching of assets and story data.

### Backend (Supabase)
- **Auth:** Supabase Auth (email/password) with role tables (`user_roles`, `rbac_permissions`). 
- **RLS:** Row‑Level Security on all tables; helper function `public.has_role(_user_id UUID, _role app_role)`. 
- **Database:** PostgreSQL, multilingual fields stored as `JSONB` (`{ en: "…", ar: "…" }`). Key tables include `ai_story_history`, `stories`, `child_profiles`, `user_subscriptions`, `subscription_plans`, `ai_usage_logs`, `ai_agents`.
- **Edge Functions (Deno/TS):** 
  - `compose‑story` – SEL story generation pipeline (planner → writer → safety → length → quality). 
  - `illustrate‑story` – user‑triggered illustration generation (must include `trigger: "user"`). 
  - `moderation` – content safety via Lovable AI Gateway. 
  - `quota` – subscription‑based usage enforcement. 
  - Shared utilities (`cors.ts`, `rateLimit.ts`, `quota.ts`, `moderation.ts`, `tts.ts`).
- **Storage:** Supabase storage for generated illustrations and audio assets.

### Payments & Billing
- **Provider:** Paddle (BSP) for subscription plans, plus manual methods (Instapay, Vodafone Cash). 
- **Integration:** Edge functions verify receipts, update `user_subscriptions`, and record `ai_audit_logs`.

### CI / Deployment
- **Package manager:** Bun (scripts in `package.json`). 
- **CI:** GitHub Actions (Bun) runs lint, type‑check, Vitest unit tests, Playwright e2e tests, and builds the PWA. 
- **Build:** `npm run build` produces a static bundle; `npm run preview` for production preview. 
- **Service Worker:** Registered in `src/pwa/registerSw.ts` (production only).

---

## 2. Production‑Readiness Assessment

### What Is Ready for Launch
- Full UI with dark mode, RTL, and responsive design.
- Core authentication flow, role‑based route protection, and email verification.
- SEL story generation pipeline functional and quality‑gated (score ≥ 18/25).
- Illustration generation works when invoked by the user (guarded by CI test).
- Subscription management via Paddle, with server‑side verification.
- CI pipeline passes lint, tests, and builds the PWA.
- Service worker registration and offline caching are operational.

### Blocking Issues
- **Monitoring & Observability:** No centralized logging/metrics (e.g., Sentry, Datadog). Edge functions lack structured request logging.
- **Rate‑Limiting / Abuse:** `rateLimit.ts` exists but not fully exercised in production; no real‑time alerting.
- **Internationalization Gaps:** Some admin UI strings missing in Arabic/French.
- **Content Moderation Edge Cases:** Certain edge‑cases for unsafe‑for‑kids content still rely on heuristic checks.
- **Analytics:** No user‑behavior analytics or A/B testing framework.
- **Scalability:** Supabase edge functions run on a single instance; high‑traffic burst handling not proven.

### Critical Risks
- **Security:** Service‑role key never exposed client‑side, but CI does not rotate secrets automatically.
- **Data Privacy:** Child profile data stored without explicit consent flow for GDPR/CCPA.
- **Compliance:** No explicit COPPA compliance checks for under‑13 users.
- **Illustration Abuse:** Guard relies on `trigger: "user"`; a malicious client could attempt to bypass.

---

## 3. AI Platform Assessment

### Current AI Agent Architecture
- **Gateway:** Lovable AI Gateway abstracts LLM, TTS, and image providers.
- **Planner:** Generates a story blueprint (4‑act SEL structure) based on user inputs.
- **Writer:** Produces multi‑page story text.
- **Safety & Quality:** Deterministic filter + quality scoring (threshold 18/25). If fails, pipeline auto‑regenerates (max 2×).
- **Illustration:** Separate edge function, ID‑based idempotency key.
- **TTS:** Browser Web Speech API first, then Lovable AI TTS, fallback to Google Cloud.

### SEL Framework Quality
- SEL blueprint enforces hero‑mentor‑companion roles and outcome mapping.\n- Quality judge evaluates emotional relevance and age‑appropriateness; scores logged in `ai_story_history`.
- Current automated checks cover profanity, violence, self‑harm, but nuanced cultural sensitivity is limited.

### Prompt Management
- Prompts are assembled in `compose‑story` using templated strings stored in `src/lib/promptTemplates.ts` (or similar). No central prompt‑versioning system; updates require code changes.

### Missing Capabilities for a World‑Class Platform
1. **Dynamic Prompt Library** with A/B testing and versioning.
2. **Adaptive SEL Scoring** using teacher/parent feedback loops.
3. **Multilingual LLM Support** – current pipeline primarily English‑centric.
4. **Real‑time Content Moderation Dashboard** for parents/teachers.
5. **Explainable AI** – expose reasoning behind SEL outcomes to caregivers.
6. **Offline Generation** – edge‑function fallback for network outages.
7. **Fine‑grained Audio Personalization** (different narrator voices per language/age).

---

## 4. Technical Debt Analysis

| Area | Findings |
|------|----------|
| **Large Files** | `src/pages/admin/*` contain several >5 KB components; consider splitting or lazy‑loading.
| **Weak Typing** | Many utility functions lack explicit return types; `any` used in several edge‑function modules.
| **Duplicate Code** | Similar authentication checks appear in both `ProtectedRoute` and `PermissionGuard` – can be consolidated.
| **Legacy Components** | Some UI components still use class‑based styling instead of Tailwind utilities (e.g., older admin widgets).
| **Deprecated Integrations** | Old `src/lib/payments.ts` references a legacy Paddle SDK version; newer API not yet adopted.
| **Schema Generation Drift** | `supabase/migrations/` sometimes out‑of‑sync with generated TypeScript types; run `supabase gen types` regularly.
| **Tests Gaps** | Edge functions have limited unit tests; no integration tests for the full SEL pipeline.

---

## 5. Improvement Roadmap

### Phase 1 – Foundation & Stability
- Consolidate auth/permission utilities.
- Refactor large admin pages into lazy‑loaded modules.
- Add missing i18n strings for admin UI.
- Stabilize CI secret rotation and add environment‑variable validation.

### Phase 2 – Security & Scalability
- Implement structured logging & monitoring (Sentry/Datadog).
- Harden rate‑limiting, add WAF rules.
- Add GDPR/CCPA consent flow and COPPA compliance checks.
- Introduce horizontal scaling for edge functions (Supabase Functions + auto‑scale).

### Phase 3 – AI Engine Enhancement
- Build a versioned prompt library with A/B testing.
- Integrate multilingual LLMs (e.g., Azure, Anthropic) for non‑English stories.
- Add feedback loop for SEL quality (parent/teacher rating UI).
- Develop explainability UI to surface SEL outcome reasoning.

### Phase 4 – Monetization Improvements
- Update Paddle integration to latest SDK.
- Add analytics dashboard for subscription churn.
- Implement referral/affiliate program.
- Introduce in‑app purchases for extra illustration packs.

### Phase 5 – Launch Readiness
- Conduct external security audit.
- Complete accessibility audit (WCAG 2.1 AA).
- Load‑test the story generation pipeline under peak traffic.
- Prepare marketing landing page and App Store listings.
- Freeze feature set and enter beta‑testing program.

---

**Document generated and placed at:** `D:/AI-Projects/Najmah-AI-Platform/docs/ARCHITECTURE_REPORT.md`

*No source code was modified.*
