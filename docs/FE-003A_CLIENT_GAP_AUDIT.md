# FE-003A — Client-Critical Gap Audit (report only)

Date: 2026-09-06. No code, runtime, UI, or backend changes were made.

## FE-003A STATUS

COMPLETE. All seven gaps inspected against the live Lovable frontend. Result:
the client-facing V1 journey is **fully functional today on Supabase + Edge
Functions**. Not one of the seven gaps blocks the client experience *now*;
they only block the FE-003 migration to Backend Core. Therefore the P0 list
below is "must exist in Backend Core before the corresponding Lovable flow is
migrated", not "broken today".

## CLIENT JOURNEY MATRIX

| Step | Frontend entry | Runtime today | Status | V1 |
|---|---|---|---|---|
| Parent auth | `src/pages/Auth.tsx`, `useAuth.tsx` | Supabase Auth + `user_roles`; RBAC also tries `/api/v2/me` (fails closed) | WORKING NOW | non-blocking |
| Child profile | `src/pages/ChildProfile.tsx`, `src/lib/childProfilesApi.ts` | Supabase `child_profiles` | WORKING VIA LEGACY | non-blocking |
| Create story (guest trial) | `src/pages/AIStoryteller.tsx` → `src/lib/trialStoryApi.ts` | Edge `trial-story` / `trial-illustrate` / `trial-pdf` | WORKING VIA LEGACY — BACKEND GAP | BLOCKING V1 (marketing funnel) |
| Generate story (signed-in) | `AIStoryteller.tsx:740` Edge `generate-story`; `src/lib/selStoryApi.ts` Edge `compose-story` | Edge + `ai_story_history` | WORKING VIA LEGACY / BACKEND READY (`POST /api/v2/stories`) | BLOCKING V1 |
| Illustrations | `src/lib/selStoryApi.ts` (`illustrate-story`), read `src/api/illustrations.api.ts` → `generated_illustrations` | Edge write, direct DB read | WORKING VIA LEGACY — read is a BACKEND GAP | BLOCKING V1 |
| Narration | `src/api/audio.api.ts`, `src/hooks/useStoryAudio.ts`, `src/lib/storyTtsApi.ts` | Edge `narrate-story-full` / `narrate-story` / `narrate-classic-story` | WORKING VIA LEGACY; delete is a BACKEND GAP | generate BLOCKING, delete NON-BLOCKING |
| Reading | `src/pages/MyAiStoryDetail.tsx`, `StoryDetail.tsx` | `ai_story_history` + `generated_illustrations` | WORKING VIA LEGACY | BLOCKING V1 |
| Export PDF | `src/lib/storyDownloads.ts:114`, `storyExportApi.ts:172` | Edge `export-story-pdf` | WORKING VIA LEGACY; PDF module exists in Backend Core | BLOCKING V1 |
| Export TXT | `storyExportApi.ts:118` Edge `export-story-txt`; also pure-client `buildTxt/downloadTxt` | Edge + client fallback | WORKING VIA LEGACY — BACKEND GAP | BLOCKING V1 (client sells TXT) |
| Export EPUB | `storyDownloads.ts:141` Edge `export-story-epub` | Edge | WORKING VIA LEGACY — BACKEND GAP | NON-BLOCKING |
| Export MP3 | `storyExportApi.ts:144` Edge `export-story-audio` | Edge | WORKING VIA LEGACY — BACKEND GAP | BLOCKING V1 |
| Batch ZIP | `src/components/story/BatchDownloadDialog.tsx` → `startBatchDownload` (`batch-download-stories`, `refresh-bundle-url`, `batch_export_jobs`, realtime channel) | Edge + direct DB + realtime | WORKING VIA LEGACY — BACKEND GAP | NON-BLOCKING |
| Downloads history | `src/pages/MyDownloads.tsx`, `storyDownloads.ts` (`download_history`, `download_audit_log`, `download_settings` RPC) | Direct Supabase, RLS-protected | WORKING VIA LEGACY — BACKEND GAP | NON-BLOCKING |
| Credits / Subscription | `useCredits.ts`, `useSubscription.tsx`, `usePaddle.tsx`, `PaddleSubscriptionCard.tsx`, `Pricing.tsx` | Credits/plans direct Supabase; Paddle hook currently throws "not yet migrated" | BACKEND GAP (billing) | BLOCKING V1 (paid launch) |

## P0 BACKEND GAPS

Only these block the client-facing V1 once migration starts.

1. **TRIAL_STORY_API_GAP** — anonymous trial story + trial illustration + trial PDF. No canonical anonymous endpoint exists in Backend Core.
2. **TXT_EPUB_EXPORT_API_GAP (TXT and MP3 halves)** — TXT export and stored MP3 export have no canonical route. PDF does (pdf module).
3. **ILLUSTRATION_READ_API_GAP** — canonical read of illustration job/page status. The UI polls every 3s and the Images ZIP action depends on it.
4. **Billing config/checkout/subscription** (already in the FE-003 matrix, restated because it is client-critical for a paid V1).

## P1 BACKEND GAPS

1. **BATCH_EXPORT_API_GAP** — multi-story ZIP bundle: create job, progress stream/poll, bundle URL refresh.
2. **EPUB half of TXT_EPUB_EXPORT_API_GAP**.
3. **AUDIO_DELETE_API_GAP** — remove narration from a saved story.
4. **DOWNLOAD_LIFECYCLE_API_GAP** — download history list/delete, audit log, download settings (formats enabled/disabled).

## P2 / ADMIN GAPS

1. **ADMIN_API_GAP** — 33 admin pages under `src/pages/admin/` read/write Supabase directly (`adminApi.ts`, `aiAdminApi.ts`, `blogAdminApi.ts`, `contentApi.ts`, `plansApi.ts`). Backend Core's `admin` controller covers only dashboard/users/subscriptions/usage (`src/api/admin.api.ts`). Internal-only, deferable.

## EACH GAP — DETAILED FRONTEND CONTRACT NEED

### 1. TRIAL_STORY_API_GAP — P0
- Pages: `src/pages/AIStoryteller.tsx` (guest path), `src/pages/StoryLibrary.tsx` (trial PDF).
- Code: `src/lib/trialStoryApi.ts` — `generateTrialStory` (`trial-story`), trial illustrate (`trial-illustrate`), `generateTrialPdf` / `downloadTrialPdf` (`trial-pdf`); state held in `AIStoryteller.tsx:153 guestTrial`.
- Visible to client: yes, to logged-out visitors. Works today via Edge.
- Today the visitor generates one free story, optionally one illustration, and downloads a trial PDF without an account.
- Required for V1: yes — it is the acquisition funnel.
- Capability required: anonymous, rate-limited/abuse-guarded story generation with optional single illustration and a downloadable trial PDF, without a Supabase user.
- Request fields (from current frontend): child name, age band, theme/topic, language, character; optional device/trial fingerprint for quota.
- Response fields: `title`, `pages[]` (`text`, optional `image_url`/prompt), trial identifier, quota-remaining/limit signal, structured error code.
- Sync (current Edge call is synchronous, UI shows a spinner). Async acceptable only with a status endpoint.
- Polling: not required today.
- UI already has loading + error states: yes.
- If absent: logged-out visitors cannot try the product at all.
- Keep Supabase behaviour temporarily: yes, until a canonical anonymous path exists.

### 2. AUDIO_DELETE_API_GAP — P1
- Page: `src/pages/MyAiStoryDetail.tsx:238`.
- Code: `useDeleteAudio` (`src/hooks/useStoryAudio.ts:50`) → `deleteAudio` (`src/api/audio.api.ts`) → `ai_story_history.audio_url = null`.
- Visible: yes, a delete-narration button. Works today via direct DB update.
- Client can remove a generated narration and regenerate it.
- V1: not required.
- Capability: delete/clear a story's narration asset for the owning user (and ideally remove the stored object).
- Request: story id. Response: success flag / new audio state.
- Sync. No polling. UI has pending + toast states.
- If absent: users keep an unwanted narration; no data loss.
- Keep current behaviour: yes.

### 3. ILLUSTRATION_READ_API_GAP — P0
- Pages: `src/pages/MyAiStoryDetail.tsx` (merges illustrations into pages for the Images ZIP), `src/pages/test/IllustrateHarness.tsx`.
- Code: `useIllustrations` (`src/hooks/useIllustrations.ts`, 3s poll while PENDING/PROCESSING/GENERATING) → `fetchIllustrations` (`src/api/illustrations.api.ts`, now reading `generated_illustrations`). The legacy `generateIllustrations` / `retryIllustrations` / `regeneratePageIllustration` in the same file still point at dead `/media/stories/:id/illustrations` routes and are unused.
- Visible: yes — page images, progress, and the Images ZIP enablement.
- V1: yes.
- Capability: read illustration job state for a story.
- Request: story id. Response exactly as the UI consumes: `jobStatus`, `totalPages`, `completedPages`, `failedPages`, `illustrations[] { pageNumber, imageUrl, status }`.
- Async job, so a **status/poll endpoint is required**.
- UI already handles loading/progress/failed states.
- If absent: no images render, no progress, Images ZIP stays disabled.
- Keep Supabase read: yes, it is the only working source.

### 4. TXT_EPUB_EXPORT_API_GAP — P0 (TXT/MP3) / P1 (EPUB)
- Pages: `MyAiStoryDetail.tsx` and `MyAiStories.tsx` download menu, `MyDownloads.tsx`.
- Code: `src/lib/storyExportApi.ts` (`export-story-txt`, `export-story-audio`, `export-story-pdf`), `src/lib/storyDownloads.ts` (`export-story-epub`, plus client-side `buildTxt`/`downloadTxt` fallback).
- Visible: yes, per-format download buttons. Works today.
- V1: TXT and MP3 yes; EPUB no.
- Capability: server-side generation of a downloadable story artifact per format, stored and returned as a time-limited signed URL, with an export record.
- Request: story id (or title + pages + language for unsaved stories), child name, language, emotion tags, page count.
- Response (mirrors `export-story-txt`): `success`, `export_id`, `download_url`, `file_name`, `file_size`, `expires_at`, `provider`, structured `error` code.
- Sync today. Async acceptable with a status endpoint.
- UI has loading/error toasts.
- If absent: TXT/MP3/EPUB buttons fail — TXT would fall back to the client-side builder only for already-loaded stories.
- Keep current behaviour: yes.

### 5. BATCH_EXPORT_API_GAP — P1
- Page/component: `src/components/story/BatchDownloadDialog.tsx` (child-scoped bundles).
- Code: `startBatchDownload` (`storyDownloads.ts:156`, `batch-download-stories`), `refresh-bundle-url` (`:182`), job rows in `batch_export_jobs` (`:175`), plus a Supabase realtime channel for progress.
- Visible: yes. Works today.
- V1: no.
- Capability: create a multi-story multi-format export job, report progress, deliver a bundle URL, and re-sign an expired bundle URL.
- Request: `childId` or `storyIds[]`, `formats[]` (`pdf`/`mp3`/`txt`).
- Response: job id, status, progress counters, `bundle_url`, `expires_at`, error.
- Async — **polling or a progress stream is required** (UI currently uses realtime).
- UI already renders progress and errors.
- If absent: bulk download is unavailable; single-story downloads unaffected.
- Keep current behaviour: yes.

### 6. DOWNLOAD_LIFECYCLE_API_GAP — P1
- Page: `src/pages/MyDownloads.tsx` (and admin `AdminDownloadsPage.tsx`).
- Code: `src/lib/storyDownloads.ts` — `download_history` insert/list/delete (`:356`, `:393`, `:403`, `:481`, `:580`, `:617`), `download_audit_log` (`:516`, `:550`, `:668`), download settings via secure RPC with `DEFAULT_DOWNLOAD_SETTINGS` fallback (`:426`) and `isFormatEnabled` (`:488`).
- Visible: yes — the client's downloads library. Works today under RLS.
- V1: history/list yes as UX, but it is satisfied by the existing legacy path; not a blocker.
- Capability: record a download, list a user's downloads (search/paginate), delete an entry, append audit events, and expose which formats are enabled without leaking internal alerting fields.
- Request: story id, format, file name/size, export id. Response: history rows with `created_at`, format, url/expiry, id.
- Sync. No polling. UI has loading/empty/error states.
- If absent: the downloads page empties and re-download of past exports is lost.
- Keep current behaviour: **yes — historical rows live only in Supabase**.

### 7. ADMIN_API_GAP — P2
- Pages: all of `src/pages/admin/*` (33 pages).
- Code: `src/lib/adminApi.ts`, `aiAdminApi.ts`, `blogAdminApi.ts`, `contentApi.ts`, `plansApi.ts`, direct `supabase.from(...)`; `src/api/admin.api.ts` targets the four canonical admin routes.
- Visible to the end client: no (staff only). Works today.
- V1: no.
- Capability: full admin CRUD/analytics parity across ~30 tables, admin-guarded.
- Sync; some analytics could be cached.
- If absent: admins keep using the current direct-DB path — no customer impact.
- Keep current behaviour: yes.

## CURRENT LEGACY PATHS THAT KEEP THE APP WORKING

- Edge Functions: `generate-story`, `compose-story`, `trial-story`, `trial-illustrate`, `trial-pdf`, `illustrate-story`, `generate-classic-illustrations`, `narrate-story`, `narrate-story-full`, `narrate-classic-story`, `narrate-story-edge`, `export-story-txt`, `export-story-pdf`, `export-story-audio`, `export-story-epub`, `export-product-story-pdf`, `batch-download-stories`, `refresh-bundle-url`.
- Direct Supabase tables: `ai_story_history`, `generated_illustrations`, `child_profiles`, `download_history`, `download_audit_log`, `batch_export_jobs`, `exports`, `export_logs`, credits/plans tables, `user_roles`.
- Storage buckets + `signStorageUrl`: `story-images`, `story-exports`, `story-pdfs` (private, signed URLs).
- Supabase Auth session and RLS as the real enforcement boundary.

## WHAT MUST NOT BE REMOVED YET

- Every Edge Function listed above — each is on a live client path.
- `ai_story_history` and `generated_illustrations` reads (the only working story/illustration source).
- `download_history` / `download_audit_log` / `batch_export_jobs` rows — historical user data with no canonical equivalent.
- `src/api/illustrations.api.ts:fetchIllustrations` (active) — the other functions in that file are dead code, safe to leave untouched.
- Private buckets, signed-URL flow, RLS policies, and SECURITY DEFINER helpers.
- FE-001 route guards and FE-002 fail-closed RBAC.

## BACKEND WORK REQUIRED BEFORE FE-003 MIGRATION

1. Deploy Backend Core to a reachable HTTPS origin; set `VITE_API_URL`; CORS for both Lovable origins; accept Supabase bearer tokens.
2. Confirm `GET /api/v2/me` returns the canonical identity JSON in the browser.
3. Billing: config, checkout, current subscription.
4. Stories: create + status poll + list + detail matching current UI fields.
5. Illustrations: job status read (exact shape above).
6. Media: narration generate, narration read, narration delete.
7. Exports: PDF, TXT, MP3 (+ EPUB later) returning signed URL + export record.
8. Anonymous trial capability (story, one illustration, trial PDF) with abuse controls.
9. Batch export job + progress + bundle refresh.
10. Download lifecycle (history, audit, settings) with a migration path for existing rows.
11. Admin parity (last).

## MINIMUM BACKEND SCOPE TO SATISFY THE CLIENT

Identity, stories (create/status/read), illustration status read, narration generate/read, exports PDF + TXT + MP3, billing config/checkout/subscription, and the anonymous trial. Everything else can stay on Supabase during staging without any visible client impact.

## RECOMMENDED IMPLEMENTATION ORDER

1. Reachable Backend Core + `VITE_API_URL` + `/api/v2/me` verified.
2. Billing (config, checkout, subscription).
3. Stories create/status/read.
4. Illustration status read.
5. Narration generate/read.
6. Exports PDF → TXT → MP3.
7. Anonymous trial.
8. Narration delete, EPUB, batch export, download lifecycle.
9. Admin parity.
