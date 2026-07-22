# Production Smoke Test Report (production-smoke-test.md)

This report logs execution logs for testing user flows from registration to reading.

---

## 1. Test Journey Log

### Step 1: Registration & Login
* **Action:** Submit email/password POST request to `/api/v2/auth/login`.
* **Verification:** Server validates credentials and returns secure HttpOnly `najmah_token` cookies.

### Step 2: Child Profile Setup
* **Action:** Add profile via POST to `/api/v2/children`.
* **Verification:** Row is created in `profiles` and mapped to parent UUID.

### Step 3: Story Generation
* **Action:** Generate story via POST to `/api/v2/stories`.
* **Verification:**
  1. Gateway verifies monthly limits and credit balances.
  2. Dispatches `story-generation` job synchronously.
  3. FastAPI microservice plans, writes, and validates quality scores.
  4. Story transitions to `GENERATED` status.

### Step 4: Page Illustrations & Audio TTS
* **Action:** Renders illustrations and triggers text-to-speech audio stitching.
* **Verification:** CDN assets load correctly.
