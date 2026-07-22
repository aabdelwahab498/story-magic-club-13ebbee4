# Najmah AI Story Platform – Development Guide (AGENTS.md)

---

## 1. Project Architecture

### Front‑end
- **Framework:** React 18, TypeScript, Vite 5 (SWC).  
- **UI:** Tailwind CSS 3, shadcn/ui primitives, custom kid‑themed design system.  
- **State:** TanStack Query v5 for server data, React Context for auth/subscription globals.  
- **Routing:** React Router v7 with lazy‑loaded routes (admin panel, story pages, etc.).  
- **Forms & Validation:** React Hook Form + Zod.  
- **Internationalisation:** i18next + react‑i18next, six locales (en, ar, de, fr, it, es) with RTL support.  
- **PWA:** Workbox service‑worker, offline caching of assets and API responses.

### Back‑end (Supabase)
- **Auth:** Supabase Auth (email/password) – `src/hooks/useAuth.tsx`.  
- **RLS:** Row‑Level Security on all tables; helper `has_role` RPC.  
- **Database:** PostgreSQL with JSONB multilingual columns, SEL‑related tables (`ai_story_history`, `sel_outcome`, etc.).  
- **Edge Functions (Deno):** 49 functions for AI pipelines, illustration, moderation, quota, payments, backups, etc.  
- **Shared Libraries:** `_shared/` (CORS, rate‑limit, quota, moderation, TTS helpers).  
- **Types:** Generated TypeScript types (`src/integrations/supabase/types.ts`).

### AI Story Pipeline (SEL Framework)
1. **Planner** – deterministic 4‑act blueprint (hero, mentor, companion, SEL outcome).  
2. **Writer** – LLM generates story pages using SEL constraints.  
3. **Safety Check** – deterministic content filter via Lovable AI Gateway.  
4. **Length Check** – enforces age‑appropriate page count.  
5. **Quality Judge** – LLM scoring (threshold ≥ 18/25).  
6. **Regeneration Loop** – up to two retries if safety or quality fails.

---

## 2. Coding Standards

- **TypeScript:** Enable `strict` mode; avoid `any`. Prefer `interface` for object shapes.  
- **Naming:** Use clear, camelCase for variables/functions, PascalCase for React components.  
- **File Structure:** Follow the established `src/` layout (`hooks/`, `lib/`, `components/`, `pages/`).  
- **Imports:** Use absolute `@/` alias; avoid barrel exports.  
- **Formatting:** Prettier + ESLint (`@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`).  
- **Documentation:** JSDoc comments for exported modules; preserve existing comments.  
- **Performance:** Keep bundles small; use dynamic imports for large admin pages.

---

## 3. AI Pipeline Rules

1. **All user‑generated input** must pass through `_shared/moderation.ts` before any AI call.  
2. **Safety & Quality checks** are mandatory; regeneration may occur only twice.  
3. **Prompt management** – prompts should be stored centrally (future improvement) and never hard‑coded in multiple places.  
4. **Quota enforcement** – every AI‑heavy function must invoke `quota.ts` to deduct user credits.  
5. **Error handling** – edge functions must return structured errors `{ success: false, code, message }`.  
6. **Logging** – actions that affect credits or user data must be logged to `ai_audit_logs`.

---

## 4. SEL Framework Rules

- **Four‑act structure** must be present in every generated story.  
- **SEL outcome** field (`sel_outcome`) is required in `ai_story_history`.  
- **Quality scoring** must meet or exceed 18/25 before a story is marked as publishable.  
- **Content must be age‑appropriate** – enforce length limits based on child age.  
- **No profanity, hate, self‑harm, or PII** – enforced by moderation step.

---

## 5. Database Rules

- **Use JSONB multilingual columns** for all user‑facing text (e.g., `{ en: "", ar: "" }`).  
- **Never delete applied migrations**; create new ones for schema changes.  
- **All tables have RLS enabled**; access is mediated via `has_role` RPC.  
- **Primary keys** are UUIDs; foreign keys must be indexed.  
- **Audit tables** (`ai_audit_logs`, `payment_logs`) must capture `user_id`, `action`, `timestamp`.

---

## 6. Supabase Security Rules

- **Never expose `SUPABASE_SERVICE_ROLE_KEY` client‑side.** Use it only in edge functions.  
- **Row‑Level Security** policies must grant read/write only to authorized roles (`admin`, `editor`, `user`).  
- **Authentication checks** – every edge function validates the `Authorization` header via `supabase.auth.getUser()`.  
- **Rate limiting** – all public functions go through `_shared/rateLimit.ts`.  
- **CORS** – configured in `_shared/cors.ts` to allow only trusted origins.

---

## 7. Frontend Rules

- **Component Library:** Use shadcn/ui primitives; extend via `src/components/ui/`.  
- **Styling:** Tailwind utilities with `kids-*` custom colors; dark mode via `dark:` prefix.  
- **Accessibility:** Semantic HTML, ARIA attributes where needed; WCAG 2.2 compliance.  
- **Internationalisation:** All static strings via `t('key')`; locale JSON files kept in `src/i18n/locales/`.  
- **Routing Protection:** Wrap protected routes with `ProtectedRoute` and `PermissionGuard`.  
- **Error handling:** Use `sonner` toasts for user feedback; error boundaries at route level.

---

## 8. Testing Requirements

- **Unit Tests:** Vitest covering hooks, utils, and pure functions.  
- **Integration Tests:** Edge functions tested with Deno’s built‑in test runner.  
- **E2E Tests:** Playwright covering critical user flows (signup, story generation, payment).  
- **Coverage:** Aim for ≥ 80 % line coverage; CI fails on lower coverage.  
- **CI Checks:** Lint, type‑check, and test suite run on every push via GitHub Actions.

---

## 9. Deployment Rules

- **Build:** `npm run build` must succeed with no lint or type errors.  
- **PWA:** Service worker generated by `vite-plugin-pwa`; verify precache list includes all critical assets.  
- **CI Pipeline:** `.github/workflows/ci.yml` runs lint, tests, builds, and deploys to Supabase Edge if merge to `main`.  
- **Environment Validation:** Front‑end env vars validated in `src/lib/env.ts`; edge functions env vars validated in `supabase/functions/_shared/env.ts`.  
- **Release Tagging:** Tag releases with semantic versioning; update `CHANGELOG.md` accordingly.

---

*This guide is the definitive source of truth for development on the Najmah AI Story Platform. It should be kept up‑to‑date as the project evolves.*
