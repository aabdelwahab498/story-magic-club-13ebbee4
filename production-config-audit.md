# Production Configuration Audit (production-config-audit.md)

This audit verifies that the platform’s runtime configuration is secure, consistent, and safe for production environment deployments.

---

## 1. Environment Variable Enforcements & Defaults

To prevent accidental use of development stubs or local default fallbacks in production, NestJS and FastAPI execute strict startup validations.

### Backend Core Environment Audit
All parameters parsed by NestJS `ConfigModule` are checked against a strict Zod schema at boot:

| Environment Variable | Production Requirement | Dev Default / Fallback | Validation Status |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Must be `production` | `development` | **Strict Enum Check** |
| `PORT` | Set by hosting environment | `3000` | Optional Coercion |
| `SUPABASE_URL` | Production database URL | *None (Fails Fast)* | **Required Valid URL** |
| `SUPABASE_ANON_KEY` | Production JWT anon key | *None (Fails Fast)* | **Required Min 10 chars** |
| `SUPABASE_SERVICE_ROLE_KEY` | Production service role key | *None (Fails Fast)* | **Required Min 10 chars** |
| `CORS_ALLOWED_ORIGINS` | Explicit domain whitelist | *None (Fails Fast)* | **Required Comma-separated** |
| `REDIS_URL` | Production Redis URL (encrypted) | *None* | Optional String |
| `PYTHON_AI_URL` | Internal service network URL | `http://localhost:8000` | Optional URL |
| `JWT_COOKIE_NAME` | Custom production cookie name | `najmah_token` | Optional String |
| `ILLUSTRATION_PROVIDER` | Must be `google` | `google` | Strict Enum |
| `AUDIO_PROVIDER` | Must be `edge` | `edge` | Strict Enum |
| `MASTER_ENCRYPTION_KEY` | Required if BYOK is active | *None* | Optional 64-char Hex regex |

*Result:* **PASS**. The application fails immediately (exits with code 1) on bootstrap if any mandatory production variable is missing or malformed, preventing partially-configured servers from starting.

---

## 2. Python AI Service Environment Audit
FastAPI settings are validated by Pydantic `BaseSettings` on startup:

| Environment Variable | Production Requirement | Dev Default / Fallback | Validation Status |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Production API key | *None (Fails Fast)* | **Required** |
| `PORT` | Listening port | `8000` | Optional Integer |
| `HOST` | Interface bind | `0.0.0.0` | Optional String |

*Result:* **PASS**. The Python microservice fails to import settings if `GEMINI_API_KEY` is not present in the shell environment.

---

## 3. Production Readiness Recommendations
- **Disable Mock Providers:** In production `.env`, ensure `ILLUSTRATION_PROVIDER` is set to `google`, `AUDIO_PROVIDER` is set to `edge`, and `MEDIA_IMAGE_PROVIDER` is set to `google` (if available, else fallback).
- **Master Encryption Key:** Provision a secure 32-byte master key via `/dev/urandom` and save it to the environment as a hex string.
