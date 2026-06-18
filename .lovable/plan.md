# AI Agent Management System — Implementation Plan

This is a large, multi-module system. I'll build it in **5 phases**, each shippable independently. Confirm before I start, and tell me if you want to descope anything.

---

## Phase 1 — Database Foundation (1 migration)

New tables (all with RLS + GRANTs + admin-only policies via `has_role`):

- `ai_agents` — personas: name, description, system_prompt, tone (enum), model, temperature, active, is_default
- `ai_prompt_templates` — name, slug, category, body, variables (jsonb), active, current_version_id
- `ai_prompt_versions` — template_id, version_no, body, changelog, created_by, published (for versioning + rollback)
- `ai_feature_toggles` — feature_key (pdf, tts, downloads, image_gen, chat, summaries, translation, writing), enabled, config jsonb
- `ai_capabilities` — agent_id, capability_key, enabled (per-agent capability map)
- `ai_usage_limits` — scope (global/role/user), user_id?, daily_limit, monthly_limit, feature_key
- `ai_usage_logs` — user_id, agent_id, feature_key, tokens_in, tokens_out, cost_usd, latency_ms, status, error
- `ai_audit_logs` — actor_id, action, entity_type, entity_id, before jsonb, after jsonb, ip, ua
- `pdf_templates` — name, layout jsonb, header_html, footer_html, branding_assets jsonb, active
- `generated_pdfs` — user_id, template_id, story_id?, url, size_bytes, status
- `audio_voice_profiles` — name, provider (openai/elevenlabs/gemini), voice_id, sample_url, language, active
- `generated_audio_files` — user_id, voice_id, text_hash, url, duration_sec, status
- Extend `app_role` enum: add `super_admin`, `editor`, `support` + a `permissions` table (role → permission_key) for fine-grained RBAC

Triggers: `updated_at` on all; audit trigger that snapshots changes to `ai_audit_logs` for agents/prompts/toggles.

## Phase 2 — Admin UI Pages

New pages under `src/pages/admin/`:

- `AdminAiAgentsPage.tsx` — list/create/edit personas, tone selector, system prompt editor, capability toggles, set default
- `AdminAiPromptsPage.tsx` — CRUD templates, version timeline, diff view, rollback button, live preview pane (renders against selected agent)
- `AdminAiFeatureTogglesPage.tsx` — switch grid for 8 features with per-feature config
- `AdminAiUsageLimitsPage.tsx` — global + per-role + per-user quotas
- `AdminAiAnalyticsPage.tsx` — KPI cards (requests, avg latency, failures, active users), feature usage bar chart, cost trend (recharts), top users table
- `AdminPdfTemplatesPage.tsx` — template editor, branding upload (logo/colors/fonts), preview, generated-PDF log
- `AdminAudioVoicesPage.tsx` — voice provider selector, voice list, sample playback, custom voice upload, usage stats
- `AdminRbacPage.tsx` — roles × permissions matrix, assign roles to users, audit trail
- `AdminAuditLogsPage.tsx` — filterable log viewer (actor, entity, date), export CSV

Wire all routes into `AdminDashboardLayout` sidebar with search.

## Phase 3 — Backend (Edge Functions + RPCs)

- `ai-agent-invoke` — central dispatcher: loads active agent + system prompt + checks feature toggle + checks quota → calls Lovable AI Gateway → logs usage
- `prompt-preview` — renders a prompt template with variables against an agent, returns sample output without persisting
- `generate-pdf-from-template` — uses `pdf_templates` row to build PDF, uploads to storage, logs
- `tts-generate` — uses selected voice profile, generates audio, caches, logs
- RPCs: `check_ai_quota(user_id, feature)`, `log_ai_usage(...)`, `rollback_prompt_version(version_id)`, `has_permission(user_id, key)`

All edge functions: CORS, JWT verify, quota enforcement, audit logging.

## Phase 4 — Wire Existing Features

Refactor existing functions (`generate-story`, `narrate-story`, `illustrate-story`, `export-story-pdf`, `ai-assistant`) to:
1. Read active agent + system prompt from DB (not hardcoded)
2. Check `ai_feature_toggles` before running
3. Call `log_ai_usage` after
4. Honor `ai_usage_limits`

This is what makes the admin toggles actually control the live site.

## Phase 5 — Polish

- Real-time updates via Supabase Realtime on `ai_usage_logs` for analytics dashboard
- CSV export for audit logs + usage logs
- Dark/light mode already exists — verify new pages
- Mobile responsive pass on all new admin pages
- Seed default agent + default toggles (all on) + super_admin permissions

---

## Scope Confirmation

This is roughly **1 large DB migration + ~10 admin pages + ~5 edge functions + refactors to ~5 existing functions**. Estimated 8–12 hours of build work spread across phases.

**Suggested approach:** I build Phase 1 (DB) + Phase 2 (UI shells with mock data wired to real tables) in this first round, then Phases 3–5 in follow-ups so you can review and steer as we go.

Reply with:
- **"Go"** to start Phase 1+2 now
- **"All at once"** to attempt everything in one large batch (higher risk of errors)
- **"Descope X"** to remove modules you don't need (e.g. skip RBAC overhaul, skip PDF templates)
