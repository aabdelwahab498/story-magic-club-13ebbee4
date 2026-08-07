# Najmah / Starry Tales — Full Project Audit (Handover Report)

> Generated: 2026-08-07 · Based on the actual code in the repository (no code was modified).
> Scope: frontend, backend (Lovable Cloud / Supabase), AI pipeline, security, deployment, export.

---

## 1. Project Overview

| Item | Value |
|---|---|
| Project name | Najmah / Starry Tales ("Najmah Story Studio") |
| Core function | AI-powered interactive children's story platform: generate, read, illustrate, narrate and export personalized stories |
| Business model | Freemium SaaS — credits + subscription plans (Paddle) + manual payment + a small physical/digital store |
| Target users | Parents (primary buyer), children 3–12 (reader), teachers, and internal admins/editors |

### Main user flows
1. **Signup / login** → email+password auth → profile + role bootstrap (`handle_new_user` trigger).
2. **Create child profile** → `/family` → `/family/:id` (age, language, avatar, interests).
3. **Generate a story** → `/ai-storyteller` → idea input → SEL pipeline (plan → write → safety → length → judge) → story saved in `ai_story_history`.
4. **Read** → `/my-stories/:id` reading mode, background music, TTS narration, illustrations.
5. **Export** → TXT / PDF / MP3 / EPUB via edge functions → private storage → signed URL → download (`/my-downloads`).
6. **Monetize** → `/pricing` → Paddle checkout or manual payment request → subscription/credits granted.
7. **Engagement** → reading streaks, drawing competition + voting, blog, store/orders.
8. **Admin** → `/admin/dashboard/*` (33 pages): stories, AI engine, prompts, agents, limits, payments, orders, RBAC, audit logs.

---

## 2. Frontend Architecture

| Layer | Technology (actual) |
|---|---|
| Framework | React 18 |
| Language | TypeScript 5 (`strict` per tsconfig.app.json) |
| Build system | Vite 5 (SWC plugin) |
| UI framework | Tailwind CSS 3 + custom `kids-*` design tokens |
| Component library | shadcn/ui on Radix primitives (49 files in `src/components/ui`) |
| Server state | TanStack Query v5 |
| Client state | React Context (`useAuth`, `useTheme`, `useSubscription`) + local hooks |
| Routing | React Router v7, lazy-loaded admin routes, `ProtectedRoute` + `PermissionGuard` |
| Forms | React Hook Form |
| Validation | Zod (+ `@hookform/resolvers`) |
| i18n | i18next + react-i18next, 6 locales: `en, ar, de, fr, it, es` |
| RTL | Yes — direction switch driven by locale (Arabic default-capable) |
| PWA | manifest + custom `src/pwa` layer, offline page, install prompt |
| Notable libs | jspdf + autotable, docx, jszip, axios, embla-carousel, sonner |

### Project tree (real)

```text
src/
├── api/            # Legacy REST client layer (axios) — client.ts, auth/stories/children/audio/admin/illustrations
├── assets/         # Images, fonts, static art
├── components/     # 127 components total
│   ├── ui/         # shadcn primitives (49)
│   ├── admin/      # Admin-only widgets (5)
│   ├── story/      # Story reading/generation widgets (6)
│   ├── payment/    # Checkout & plan widgets (7)
│   ├── cart/       # Store cart (1)
│   └── *.tsx       # ~60 shared/feature components (Layout, Navigation, BottomNav, SelStoryViewer, ...)
├── hooks/          # 31 hooks: useAuth, useRoles, useCredits, useStoryExport, useStoryAudio, useSubscription, ...
├── i18n/           # config.ts + locales/{en,ar,de,fr,it,es}.json
├── integrations/   # supabase/ (auto-generated client + types), lovable/
├── lib/            # 40+ modules: API wrappers (aiStoryApi, storyExportApi, subscriptionApi...), utils, mock data
├── pages/          # 38 public/user pages + pages/admin (33 admin pages)
├── pwa/            # Service-worker registration & offline handling
├── test/           # Vitest integration tests
├── App.tsx         # Route table + providers
└── main.tsx        # Entry
```

There is **no `src/services/`, `src/utils/`, `src/contexts/`, or `src/types/` folder** — those roles are filled by `src/lib`, `src/api`, `src/hooks` and `src/types.ts` respectively.

Backend / infra folders at repo root: `supabase/functions` (48 edge functions), `supabase/migrations` (96), `docs/`, `e2e/`, `docker/`, `grafana/`, `prometheus/`, `scripts/`, plus legacy `backend-core/`, `ai-service/`, `shared/` (not used by the running app).

---

## 3. Pages Inventory

### Public / user pages (`src/pages`, 38)

| File | Route | Purpose | Key components | Status |
|---|---|---|---|---|
| Index.tsx | `/` | Landing/home | Hero, CountersSection, HomeBlogPreview, HomeCompetitionHighlight, WinnerOfTheWeek | Complete |
| Auth.tsx | `/auth` | Login/signup | forms, ResendConfirmation | Complete |
| AdminAuth.tsx | `/admin/auth` | Admin login | form + role check | Complete |
| ForgotPassword / ResetPassword | `/forgot-password`, `/reset-password` | Password recovery | forms | Complete |
| StoryLibrary.tsx | `/stories` | Classic story catalog | StoryCard | Complete |
| StoryDetail.tsx | `/stories/:id` | Read a classic story | ReadingMode, NarratorPicker, StoryBackgroundMusic | Complete |
| AIStoryteller.tsx | `/ai-storyteller` | Generate an AI story | OptionSelector, ChildPicker, SelStoryViewer, CreditCounter, FreeTrialDialog | Complete (core) |
| MyAiStories.tsx | `/my-stories` | User's generated stories | StoryCard | Complete |
| MyAiStoryDetail.tsx | `/my-stories/:id` | Read/export/illustrate/narrate | SelStoryViewer, IllustrateButton, export buttons | Complete, export layer fragile |
| MyDownloads.tsx | `/my-downloads` | Export history + signed links | tables | Complete |
| MyBackups.tsx | `/my-backups` | User data backups | tables | Complete |
| Family.tsx / ChildProfile.tsx | `/family`, `/family/:id` | Child profiles | AvatarCreator, ChildPicker | Complete |
| ParentDashboard.tsx | `/parent` | Parent overview, streaks, usage | StreakCard, UsageSummary | Complete |
| Pricing.tsx | `/pricing` | Plans | PaddleSubscriptionCard, UpgradeModal | Complete |
| AccountSubscription.tsx | `/account/subscription` | Manage subscription | PaddleSubscriptionCard | Complete |
| AccountProfile.tsx | `/account/profile` | Profile settings | forms | Complete |
| ApiKeys.tsx | `/account/api-keys` | BYOK keys | SecureFileUpload-free forms | Complete |
| Store.tsx | `/store` | Product store | cart components | Partial (mock data in places) |
| CheckoutManual / CheckoutOrder | `/checkout/manual`, `/checkout/order` | Payment flows | payment components | Complete |
| PaymentResult.tsx | `/payment/result` | Post-checkout state | — | Complete |
| DrawingCompetition.tsx | `/drawing-competition` | Contest + voting | DrawingEntry, HallOfFame, WinnerCard | Complete |
| Blog.tsx / BlogPost.tsx / BlogSubmit.tsx | `/blog`, `/blog/:slug`, `/blog/submit` | Blog | BlogCard, Seo | Complete |
| Contact.tsx | `/contact` | Contact form → email fn | form | Complete |
| About / Privacy / Terms | `/about`, `/privacy`, `/terms` | Static | LegalPage | Complete |
| Install.tsx / Offline.tsx | `/install`, `/offline` | PWA | InstallPwaButton, OfflineBanner | Complete |
| DownloadTest.tsx | `/download-test` | Internal export debugging | export buttons | Dev-only — should not ship |
| Admin.tsx | `/admin` | Legacy admin entry | redirects | Legacy |
| NotFound.tsx | `*` | 404 | — | Complete |

### Admin pages (`src/pages/admin`, 33)
`AdminDashboardLayout` (shell) + `AdminDashboardOverview` and: Stories, StoryEngine, AiModels, AiAgents, AiPrompts, AiFeatureToggles, AiUsageLimits, AiUsage, AiAnalytics, IllustrationAnalytics, Audio, AudioVoices, PdfTemplates, AuditLogs, Rbac, Downloads, Videos, Blog, Payments, PaymentSettings, PaymentLogs, Plans, Products, Orders, Subscriptions, WebhookLogs, ContactInbox, Languages, Settings, N8nIntegration.

Status: most are complete CRUD screens against Supabase. **Four still read mock data** (`AdminVideosPage`, `AdminStoriesPage`, `AdminDashboardOverview`, `AdminLanguagesPage` via `src/lib/adminMockData.ts` / `contentApi.ts`). `AdminN8nIntegrationPage` is a leftover from the removed n8n integration.

---

## 4. Components Map

- **Layout**: `Layout.tsx` (Outlet shell) → `Navigation`, `BottomNav` (mobile fixed), `Footer`, `PageBackground` (starry canvas), `ThemeToggle`, `LanguageSwitcher`, `OfflineBanner`, `SwUpdateIndicator`, `ErrorBoundary`.
- **Auth/guard**: `ProtectedRoute` (session) → `PermissionGuard` (RBAC via `has_permission`) → admin routes.
- **Story feature**: `SelStoryViewer` (page-by-page reader) ← `ReadingMode`, `NarratorPicker`/`NarratorAvatar`/`BrowserNarratorSettings` (TTS), `StoryBackgroundMusic`, `IllustrateButton`, `StoryCard`.
- **Generation feature**: `OptionSelector`, `ChildPicker`, `AvatarCreator`, `CreditCounter`, `FreeTrialDialog`, `UpgradeModal`, `UsageSummary`.
- **Monetization**: `PaddleSubscriptionCard`, `components/payment/*`, `components/cart/*`, `PremiumBadge`, `SpinWheelModal`, `SubscriptionWheelTeaser`.
- **Engagement**: `StreakBadge`/`StreakCard`, `WeeklyChallenge`, `DrawingEntry`, `HallOfFame`, `WinnerCard`, `WinnerOfTheWeek`, `NotificationBell`, `CountdownTimer`, `AnimatedCounter`.
- **UI primitives**: `components/ui/*` (shadcn) — consumed by every layer; no component bypasses them for dialogs/forms.
- **Admin**: `components/admin/*` (tables, filters) used only by `pages/admin`.

Dependency direction is clean: `pages → feature components → ui primitives`, with data access through `hooks/` and `lib/`.

---

## 5. Data Layer

- **Primary backend**: Lovable Cloud (Supabase). Client: `src/integrations/supabase/client.ts` (auto-generated) with URL/key from `src/lib/env.ts` (hard fallbacks so share-preview never crashes).
- **Legacy layer**: `src/api/*` (axios, `VITE_API_URL`) — remnants of a removed NestJS backend. Still imported by ~20 files; most calls now proxy to Supabase, but the axios client and `VITE_BACKEND_URL` reference in `useCredits.ts` are dead weight.
- **Tables (69)** including: `profiles`, `user_roles`, `rbac_permissions`, `child_profiles`, `stories`, `ai_story_history`, `ai_agents`, `ai_prompt_templates`/`versions`, `ai_usage_logs`/`limits`, `ai_audit_logs`, `generated_illustrations`/`pdfs`/`audio_files`, `exports`, `export_logs`, `download_history`/`settings`/`audit_log`, `orders`, `order_items`, `products`, `cart_items`, `subscription_plans`, `user_subscriptions`, `paddle_*`, `manual_payment_requests`, `blog_*`, `drawing_entries`/`votes`, `reading_streaks`, `waitlist`, `user_backups`, `upload_security_logs`, `rate_limit_*`.
- **Auth flow**: Supabase Auth (email/password) → `handle_new_user` trigger creates `profiles` + default role → `useAuth` context holds session → roles fetched from `user_roles` → `has_role()` / `has_permission()` SECURITY DEFINER RPCs drive UI guards and RLS.
- **Storage buckets**: `story-pdfs`, `story-audio`, `story-images`, `story-music`, `story-epubs`, `user-backups`, `temp-uploads` — private, accessed through signed URLs.
- **External services**: Lovable AI Gateway (default), OpenAI/Gemini/OpenRouter (BYOK), ElevenLabs & Google Cloud TTS (optional voices), Paddle (payments), Brevo (email), optional ClamAV scan service, Slack alerts.

---

## 6. AI Features Analysis

**Where AI is invoked** — only inside edge functions (never from the browser):

| Function | Role |
|---|---|
| `generate-story`, `compose-story`, `trial-story` | SEL story generation pipeline |
| `_shared/sel/*` | Planner (4-act blueprint), writer prompts, length check, quality judge (≥18/25), regeneration loop (max 2) |
| `_shared/moderation.ts` | Deterministic + LLM safety filter on all user input |
| `illustrate-story`, `generate-classic-illustrations`, `trial-illustrate` | Image generation per page prompt |
| `narrate-story*`, `export-story-audio`, `_shared/tts.ts` | TTS narration + MP3 export, provider abstraction (OpenAI / ElevenLabs / Google) |
| `generate-story-music` | Ambient background track |
| `ai-assistant` | In-app helper |

**Models in use**: `google/gemini-2.5-flash` (main writer/judge), `gemini-2.5-flash-lite` and `openai/gpt-5-nano`/`gpt-5-mini` (moderation), `google/gemini-2.5-flash-image` and `gemini-3.1-flash-image-preview` / `gpt-image-1` (illustration), `openai/gpt-4o-mini-tts` (speech). Admin UI can switch models per agent (`AdminAiModelsPage`, `AdminStoryEnginePage`).

**Prompts**: partially centralized in `ai_prompt_templates` + `ai_prompt_versions` (admin-editable, versioned); the SEL system prompts still live in `supabase/functions/_shared/sel/`. This split is the main AI-side technical debt.

**Workflow**: request → auth check → rate limit → quota/credits (`check_story_quota`, `consume_credits`) → moderation → plan → write → safety → length → judge → (retry ≤2) → persist to `ai_story_history` → log to `ai_usage_logs` + `ai_audit_logs`. All responses use `{ success, code, message }`.

n8n was fully removed from the runtime path; only `AdminN8nIntegrationPage`, `src/lib/adminN8nApi.ts`/`n8nStoryApi.ts` and the `n8n-*` edge functions remain as dead code.

---

## 7. Environment Configuration

**Frontend (`.env`, auto-managed by Lovable):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`. Legacy/unused: `VITE_API_URL`, `VITE_BACKEND_URL`.

**Edge function secrets (values never exposed):** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `ELEVENLABS_API_KEY`, `GOOGLE_CLOUD_TTS_API_KEY`, `BYOK_ENCRYPTION_KEY`, `PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN`, `PADDLE_WEBHOOK_SECRET`, `PADDLE_ENVIRONMENT`, `BREVO_API_KEY`, `CONTACT_FROM_EMAIL`, `WELCOME_FROM_EMAIL`, `APP_URL`, `ALLOWED_ORIGINS`, `ADMIN_MASTER_KEY`, `CLAMAV_SCAN_URL`, `CLAMAV_SCAN_SECRET`, `SLACK_API_KEY`.

**Config files:** `vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`, `components.json`, `eslint.config.js`, `postcss.config.js`, `vitest.config.ts`, `playwright.config.ts`, `supabase/config.toml`, `Dockerfile`, `docker-compose*.yml`, `.env.example`, `.env.production.example`.

**Key dependencies:** react 18, react-router-dom 7, @supabase/supabase-js 2, @tanstack/react-query 5, i18next 26, tailwind 3, jspdf 4, docx 9, jszip 3, zod, react-hook-form, axios (legacy).

---

## 8. Security Review

**Strong points**
- RLS enabled on all public tables; roles isolated in `user_roles` (no role column on profiles) with `has_role`/`has_permission` SECURITY DEFINER helpers.
- `EXECUTE` revoked from `PUBLIC` on 24 SECURITY DEFINER functions; credit mutations restricted to `service_role`.
- Immutability guards on `orders`, `manual_payment_requests`, `user_subscriptions` (triggers prevent self-upgrade / price tampering).
- All storage buckets private; downloads via short-lived signed URLs, with `download_audit_log`.
- Edge functions validate the Authorization header, apply `_shared/rateLimit.ts` and `_shared/cors.ts` (origin allow-list).
- Uploads pass through `upload-init` / `upload-finalize` with size caps, `user_daily_upload_bytes`, and optional ClamAV scan.

**Risks / gaps**
1. `DownloadTest` route (`/download-test`) is publicly reachable in production builds.
2. Anon key + project URL hardcoded as fallback in `src/lib/env.ts` — acceptable (publishable) but couples the repo to one backend and blocks clean self-hosting.
3. Dead n8n endpoints (`n8n-export-*`, `n8n-story-generate`, `admin-n8n-settings`) still deployed — unused attack surface.
4. Mixed data sources in 4 admin pages (mock vs. real) can hide authorization mistakes.
5. No CSP / security headers defined for the static host.
6. Legacy axios client would send requests to `VITE_API_URL` if that variable were ever set.

---

## 9. Deployment Readiness

**Run locally**
```bash
npm install          # or bun install
cp .env.example .env # fill VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev          # http://localhost:8080
```
**Other commands:** `npm run build`, `npm run build:dev`, `npm run preview`, `npm run lint`, `npm test` (Vitest), `npm run e2e` (Playwright).

**Build process:** Vite → static `dist/` (SPA, needs history fallback to `index.html`). No SSR. `manualChunks` was removed deliberately — do not re-add without testing the React runtime.

**Needed to deploy:** `dist/`, SPA rewrite rule, the two `VITE_*` env vars, plus a Supabase project holding `supabase/migrations` (96) and `supabase/functions` (48).

**Portable outside Lovable?** Frontend: yes, immediately. Backend: yes, but requires a self-managed Supabase project, re-running all migrations, deploying all edge functions and re-creating ~22 secrets. Estimated effort: 1–2 days for a competent team.

---

## 10. Export Plan

**A. GitHub**
1. Lovable → GitHub → Connect / Transfer repository (pushes full history).
2. Verify `.gitignore` excludes `.env`, `node_modules`, `dist`, `*.tsbuildinfo`.
3. Add branch protection + reuse `.github/workflows` for CI (lint, typecheck, test, build).

**B. Local development**
1. `git clone` → `npm install`.
2. Create `.env` from `.env.example`.
3. Optional full-local backend: `npx supabase start`, `npx supabase db reset` (applies all migrations), `npx supabase functions serve`.
4. `npm run dev`.

**C. Vercel / Netlify**
- Build command `npm run build`, output `dist`, Node 20.
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- SPA rewrite: Vercel `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`; Netlify `/* /index.html 200`.
- Add the deployed domain to Supabase Auth redirect URLs and to `ALLOWED_ORIGINS` for edge functions.

**D. Docker**
- A `Dockerfile` and `docker-compose*.yml` already exist (multi-stage build → static server).
- `docker build -t najmah . && docker run -p 8080:80 -e ... najmah`; pass `VITE_*` at build time (Vite inlines them).
- `grafana/` + `prometheus/` compose files exist for observability if self-hosting.

**E. Backend migration checklist** — create Supabase project → `supabase link` → `supabase db push` → `supabase functions deploy` (48) → set all secrets → configure Auth providers/redirects → re-create the 7 storage buckets (private) → verify RLS with the integration tests in `src/test`.

---

## 11. Final Assessment

**Completion: ~82%** — frontend ~90%, backend/DB ~85%, AI pipeline ~85%, exports ~70%, admin ~75%, test coverage ~35%.

**Top current problems**
1. Export pipeline (PDF/MP3) still hits worker CPU/memory limits on long or heavily illustrated stories.
2. 4 admin pages served from mock data.
3. Dead code: n8n modules/functions, legacy `src/api` axios layer, `backend-core/`, `ai-service/`, `shared/`.
4. `/download-test` exposed in production.
5. Prompts split between DB and hardcoded SEL files.
6. Test coverage far below the 80% target stated in AGENTS.md (20 test files).
7. No CSP/security headers; no error-tracking service wired.
8. Repo root cluttered with ~20 phase/report markdown files, obscuring real docs.

**Top 10 steps before production launch**
1. Stabilize PDF/MP3 export (chunking or background job) and verify with long Arabic stories.
2. Replace mock data in the 4 admin pages with real queries.
3. Delete n8n code + endpoints and the legacy `src/api` axios client.
4. Remove `/download-test` from the production route table.
5. Centralize all prompts in `ai_prompt_templates`.
6. Raise test coverage on auth, quota, export and payment flows; run the Playwright suite in CI.
7. Add security headers (CSP, HSTS, X-Frame-Options) at the hosting layer.
8. Add error monitoring + edge-function alerting.
9. Full end-to-end payment rehearsal on Paddle sandbox → production (webhook signature verified).
10. Load-test story generation and confirm quota/credit accounting under concurrency.

**Recommendation:** the frontend can be **feature-frozen** — its architecture, routing, i18n/RTL and design system are production-grade. Remaining work should be limited to cleanup (dead code, mock data, dev route) and to backend hardening of the export pipeline, prompts and test coverage.
