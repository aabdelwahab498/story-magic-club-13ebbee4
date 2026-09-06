# FE-003 — Backend Core Convergence: Audit & Blocker Report

Status: **BLOCKED — NOT CONVERGED (no code changed)**
Date: 2026-09-06
Scope: frontend audit only. Backend, migrations, Edge Functions, UI: untouched.

---

## 1. BLOCKER (verified, not inferred)

The canonical NestJS Backend Core is **not reachable from the running frontend**.

FACTS:

| Check | Result |
|---|---|
| `VITE_API_URL` in the app environment | **not set** (only `VITE_SUPABASE_*` exist) |
| `src/api/client.ts` fallback baseURL | `/api/v2` (same-origin) |
| `GET https://story-magic-club.lovable.app/api/v2/billing/config` | HTTP 200 returning **index.html**, not JSON |
| `GET http://localhost:8080/api/v2/me` | HTTP 200 returning **index.html**, not JSON |
| `backend-core/` NestJS source present in repo | Yes (17 controllers) |
| NestJS service deployed / running anywhere | **No evidence found** |

Consequence: every canonical call would resolve to the SPA HTML document, and
axios would fail JSON parsing or silently receive HTML. Because FE-003 explicitly
forbids silent Edge fallback ("NO AUTOMATIC LEGACY FALLBACK"), executing the
migration now would take **billing, story generation, audio, illustrations, PDF and
ZIP export from working to fully broken** in preview and production.

Therefore FE-003 was **not executed**. The audit deliverable (RULE #1) is below.

---

## 2. Backend Core controller inventory (`backend-core/src`)

`auth`, `health`, `users`, `users/me` (subscriptions), `users/me/usage`,
`users/me/credits`, `users/me/children`, `me`, `stories`, `media` (media +
audio controllers), `billing`, `subscriptions` (plans), `admin`, `metrics`,
plus root app controller. Global prefix resolves to `/api/v2`.

---

## 3. Migration matrix

### P0 — Billing / Paddle
| Frontend | Current runtime | Canonical target | Action |
|---|---|---|---|
| `src/hooks/usePaddle.tsx` | throws `Paddle integration is not yet migrated` | `GET /api/v2/billing/config` | MIGRATE (blocked) |
| `src/hooks/useUpgrade.ts` | legacy path | `POST /api/v2/billing/checkout` | MIGRATE (blocked) |
| `src/components/PaddleSubscriptionCard.tsx` | `supabase.from('paddle_subscriptions')` | `GET /api/v2/users/me/subscription` | MIGRATE (blocked) |

### P0 — Story generation
| Frontend | Current runtime | Canonical target | Action |
|---|---|---|---|
| `src/lib/selStoryApi.ts` | Edge `compose-story` | `POST /api/v2/stories` + status poll | MIGRATE (blocked) |
| `src/pages/AIStoryteller.tsx` | Edge `generate-story` | `POST /api/v2/stories` | MIGRATE (blocked) |
| `src/lib/trialStoryApi.ts` | Edge `trial-story` | no canonical anonymous-trial endpoint found | **API GAP: TRIAL_STORY_API_GAP** |
| `src/lib/aiStoryApi.ts` | `ai_story_history` reads | `GET /api/v2/stories` | MIGRATE (blocked) |

### P0 — Persistent audio
| Frontend | Current runtime | Canonical target | Action |
|---|---|---|---|
| `src/api/audio.api.ts` | Edge `narrate-story-full`, `ai_story_history.audio_url` | `media` controller audio routes | MIGRATE (blocked) |
| preview TTS (`narrate-story`, `narrate-classic-story`, `narrate-story-edge`) | Edge | `POST /api/v2/media/tts` if present | MIGRATE (blocked) |
| audio delete | `ai_story_history` update | none found | **API GAP: AUDIO_DELETE_API_GAP** |

### P1 — Illustrations
| Frontend | Current runtime | Canonical target | Action |
|---|---|---|---|
| trigger (`illustrate-story`, `generate-classic-illustrations`) | Edge | media illustration route | MIGRATE (blocked) |
| read `src/api/illustrations.api.ts`, `MyAiStoryDetail.tsx` | `generated_illustrations` direct | canonical media status read | verify contract; else **ILLUSTRATION_READ_API_GAP** |

### P1 — Exports
| Frontend | Current runtime | Canonical target | Action |
|---|---|---|---|
| PDF (`export-story-pdf` ×3, `export-product-story-pdf`, `trial-pdf`) | Edge | `pdf` module route | MIGRATE (blocked) |
| TXT / EPUB / audio export | Edge | none found | **API GAP: TXT_EPUB_EXPORT_API_GAP** |
| ZIP (`batch-download-stories`, `refresh-bundle-url`, `batch_export_jobs`) | Edge + direct DB | none found | **API GAP: BATCH_EXPORT_API_GAP** |

### P2 — Download lifecycle (`src/lib/storyDownloads.ts`)
`download_history`, `download_audit_log`, `download_settings` (via secure RPC),
`export_logs` — all direct Supabase, RLS-protected. No canonical equivalents
found → **DOWNLOAD_LIFECYCLE_API_GAP** (classified LEGACY COMPATIBILITY).

### P3 — Admin
`src/api/admin.api.ts` → Backend Core (unreachable today).
`src/lib/adminApi.ts`, `src/lib/aiAdminApi.ts`, `src/lib/blogAdminApi.ts`,
`src/lib/contentApi.ts`, `src/lib/plansApi.ts` → direct Supabase, RLS + admin
policy protected. The `admin` controller covers only a fraction → **ADMIN_API_GAP**.

---

## 4. Current totals

- 25 `supabase.functions.invoke(` call sites across 18 distinct Edge Functions.
- 50 `supabase.from(` call sites across ~30 tables.

---

## 5. What unblocks FE-003

1. Deploy Backend Core to a reachable HTTPS origin (VPS / container).
2. Set `VITE_API_URL` to that origin in the Lovable environment.
3. Confirm `GET /api/v2/me` returns JSON from the browser with a Supabase bearer token, and CORS allows the Lovable origins.
4. Close (or explicitly accept) the API gaps listed above.

Once reachable, FE-003 can execute in the stated P0→P3 order with no UI change.
