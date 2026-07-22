# Najmah v1.0 API Readiness Report (api-readiness-report.md)

This report details endpoint inventories, environment profiles, and security guards for all public-facing backend APIs.

---

## 1. Authentication & Security Guard Architecture
* **JWT Cookie Validation:** The API gateway intercepts requests and validates `najmah_token` cookies. If missing, requests fail-closed.
* **RBAC Guard Validation:** Enforced via NestJS guards checking `@Roles()` and `@Permissions()` annotations.
* **Input Validation:** All controller routes validate input parameters using `ValidationPipe` with `class-validator` DTO annotations.

---

## 2. API Endpoint Inventory

| Endpoint Route | HTTP Method | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `/api/v2/health/live` | `GET` | No | Liveness probe check |
| `/api/v2/health/ready` | `GET` | No | Database and gateway readiness check |
| `/api/v2/auth/login` | `POST` | No | Login session generation |
| `/api/v2/me` | `GET` | Yes | Retrieves current user profile |
| `/api/v2/stories` | `POST` | Yes | Creates and schedules story generation |
| `/api/v2/stories/:id` | `GET` | Yes | Retrieves single story metadata |
| `/api/v2/media/tts` | `POST` | Yes | Converts page text to speech |
| `/api/v2/media/illustrate` | `POST` | Yes | Triggers page illustration generation |

---

## 3. Configuration Management

* **Required Env Variables:**
  - `PORT`: Server listen port (default 3000).
  - `NODE_ENV`: Target execution profile (`development`, `production`, `test`).
  - `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`: Supabase endpoints.
  - `CORS_ALLOWED_ORIGINS`: Comma-separated allowlist of allowed domains.
* **Optional Env Variables:**
  - `GEMINI_API_KEY`: API key for Google Gemini (delegated to FastAPI if mocked).
  - `MASTER_ENCRYPTION_KEY`: Hex-encoded AES encryption secret.
