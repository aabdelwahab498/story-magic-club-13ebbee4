# Illustration E2E tests

Run with:

```bash
npm run e2e:install   # one-time: download Chromium
npm run e2e
```

Covers: queued timestamps, retry disabled-until-failure, readiness badge updates,
client-side dedup of repeated Retry presses, and toast lifecycle (queued → generating → failed/success).

Network is mocked via Playwright's page.route — no real Supabase calls are made.
The harness page lives at /test/illustrate-harness.
