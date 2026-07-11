## n8n Integration Settings — Admin Dashboard Page

Add a dedicated admin page where the owner can manage the n8n webhook connection (URL + shared secret) for all three export environments (TXT / MP3 / PDF), without needing to touch environment variables.

### 1. Database
New table `n8n_integration_settings` (single-row config):
- `id uuid pk`
- `webhook_base_url text` — e.g. `https://xxx.app.n8n.cloud/webhook/starry-tales`
- `webhook_secret_set boolean` — true if a secret exists (secret itself never returned to client)
- `txt_enabled`, `mp3_enabled`, `pdf_enabled` boolean (default true) — toggle each workflow
- `last_tested_at`, `last_test_status` (`ok` / `failed` / `null`), `last_test_message`
- `updated_by uuid`, `updated_at timestamptz`

RLS: only `admin` role can `SELECT` / `UPDATE`. Grants for `authenticated` + `service_role`.

The actual `N8N_WEBHOOK_SECRET` value stays in Supabase Edge Function Secrets (never exposed to the browser); the table only tracks whether it's set + metadata.

### 2. Edge Functions
- **`admin-n8n-settings`** (new): admin-only. `GET` returns current row. `PUT` updates URL + toggles. `POST /set-secret` writes the secret into a `n8n_webhook_secret` row in a private `secrets` table read by the export functions (or updates a KV row). `POST /test` pings `{base_url}/health` (or a configurable path) with the secret header and stores the result.
- **`n8n-export-txt` / `n8n-export-audio` / `n8n-export-pdf`** (existing): switch from reading `Deno.env.get("N8N_WEBHOOK_URL")` to reading `n8n_integration_settings` (base URL + per-kind toggle) + the stored secret. Fallbacks (local renderer / Edge-TTS / `export-story-pdf`) stay unchanged when disabled or unset.

### 3. Admin UI — `src/pages/admin/AdminN8nIntegrationPage.tsx`
Sections:
1. **Connection** — URL input, "Save", masked "Secret" input with "Update secret" (writes via edge fn; never re-fetches).
2. **Workflows** — three toggles: TXT / MP3 / PDF, each with the exact webhook path the user must configure in n8n (`/export-txt`, `/export-audio`, `/export-pdf`) and a copy button.
3. **Test Connection** — button per workflow → calls the test edge function → shows ✅/❌ + last tested timestamp.
4. **Status banner** — "Currently using: n8n" vs "Currently using: local fallback" per workflow.
5. **Help card** — short Arabic + English steps: create webhook node in n8n → set path → set header `x-n8n-secret` → save the same secret here.

Route: `/admin/integrations/n8n`, added to `AdminDashboardLayout` sidebar under a new "Integrations" group, gated by `requireAdmin`.

### 4. Frontend client
- `src/lib/adminN8nApi.ts` — `getSettings()`, `updateSettings()`, `updateSecret()`, `testWorkflow(kind)`.
- No changes needed in `N8nExportBar` / `useN8nExport` / `n8nExportApi.ts` — the switch happens server-side in the edge functions.

### 5. Migration order
1. Create table + RLS + grants.
2. Insert default row.
3. Deploy `admin-n8n-settings` edge function.
4. Update 3 export edge functions to read settings from DB (with env-var fallback for backwards compatibility during rollout).
5. Add admin page + route + sidebar link.

### Acceptance
- Owner logs in → navigates to Admin → Integrations → n8n → pastes URL + secret → toggles workflows → clicks Test → sees ✅.
- Exports on the client automatically start routing through n8n; disabling a toggle falls back to local generator with zero code change.
- Non-admins get 403 on both the page and the edge function.
