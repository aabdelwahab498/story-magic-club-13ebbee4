
# NajmaH Business Model Refactor

Large change touching DB, edge functions, and UI. I'll deliver in 4 sequenced parts.

## Part 1 — Database schema

New migrations:

1. **`app_settings` table** (singleton row) with `allow_free_registrations BOOLEAN DEFAULT true` + RLS: anyone reads, admins update.
2. **`waitlist` table**: `email`, `name`, `created_at`. Public insert, admin read.
3. **`ai_story_history`**: add `visibility TEXT DEFAULT 'private' CHECK IN ('public','private')`. Backfill existing.
4. **`illustration_credits` table**: `user_id`, `balance INT`, `monthly_allocation INT`, `last_reset_at`, `lifetime_only BOOLEAN`. One row per user, seeded on signup via trigger.
5. **`subscription_plans`**: add `illustration_credits INT`, `credits_reset_monthly BOOLEAN`, `daily_story_limit INT`, `monthly_story_limit_v2 INT`. Seed values:
   - free: 20 credits lifetime, 3/day, 30/month
   - parent ($9): 80 credits monthly, 7/day, 210/month
   - pro_creator ($19): same as parent + BYOK
   - elite_publisher ($39): higher + BYOK
6. **RPC functions**:
   - `check_story_quota(user_id)` returns `{allowed, daily_used, daily_limit, monthly_used, monthly_limit}`
   - `consume_illustration_credits(user_id, amount)` returns `{success, balance}`
   - `reset_monthly_credits()` cron-callable
   - `register_allowed()` returns boolean

## Part 2 — Edge function changes

- **`generate-story`, `compose-story`, `trial-story`, `narrate-*`**: Remove all `ai_credits_exhausted` / `consumeCredits` paths. Replace `enforceMonthlyStoryQuota` with new `enforceStoryFairUse` (daily + monthly counts from `ai_story_history`).
- **`illustrate-story`, `generate-classic-illustrations`**: 
  - Hard-cap pages to 8.
  - Call `consume_illustration_credits(uid, 10)` before generation.
  - If returns 0 and tier ∈ {pro_creator, elite_publisher} with valid BYOK → use user key.
  - Else return 402 `illustration_credits_exhausted`.
- **New `signup` guard**: in `Auth.tsx` signup flow, call `register_allowed()` RPC first; block free-tier signup if false.
- **New `join-waitlist` edge function** (public insert).

## Part 3 — Frontend

- **Admin Settings page**: add "Allow Free Registrations" toggle wired to `app_settings`.
- **Auth page**: pre-check `register_allowed`; on block show `<RegistrationClosedModal>` with "Join Waitlist" + "View Premium Plans" actions.
- **New `WaitlistDialog.tsx`**: email + name form.
- **AIStoryteller**:
  - Hide visibility toggle for free users; force `visibility: 'public'`.
  - Default story pages to 8 (was 15).
  - Before Illustrate click → show `<IllustrateConfirmDialog>` ("10 credits, 8 pages"). Button disabled while in-flight (already partially done via `IllustrateButton`).
  - Replace `ai_credits_exhausted` UI handler with `illustration_credits_exhausted`; CTAs: Upgrade, BYOK (if eligible tier), Cancel.
- **CreditCounter**: change semantics — show illustration credits balance (not story count). Format: `X/20 illustration credits` (free) or `X/80 monthly` (parent).
- **MyAiStories / StoryLibrary**: show community badge on public stories.

## Part 4 — Community Library

Existing `stories` table is admin-curated. We'll surface free-tier `ai_story_history` rows with `visibility='public'` via a new `community_stories` view + page route `/community` listing them. (Lightweight — no new moderation flow; relies on existing safety_passed.)

## Out of scope / preserved

- Payment gateways untouched.
- Existing BYOK encryption + RLS preserved.
- `manage-user-api-key` unchanged.

## Order of execution

1. Migrations (Part 1) — single migration file, awaiting approval.
2. Edge functions (Part 2).
3. Frontend wiring (Part 3 + 4).
4. Smoke test: register-disabled flow, free story → public, illustrate → confirm → credit deduct, BYOK fallback at 0 credits.

## Risks / notes

- Existing users with `monthly_story_limit` on old plans: kept for backwards compat; new logic reads new column with fallback.
- "Parent Tier $9" — current schema has `pro_creator` ($19) and `elite_publisher` ($39); I'll add/rename a `parent` tier. Confirm if "parent" should replace an existing tier or be new.
- Free-tier 20 lifetime credits = users who already illustrated lose remaining quota; we'll seed `balance = 20` for all existing free users (no clawback).

Ready to proceed on approval. If "parent" tier mapping is wrong, tell me which existing tier maps to $9 and I'll adjust before migration.
