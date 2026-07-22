# Production Configuration Audit (production-config.md)

This report audits the required production settings, JWT validations, and secret sanitization layers before deployment.

---

## 1. Environment Configurations

### Backend Core
* `NODE_ENV=production`
* `DATABASE_URL`: Production Postgres URL (pointing to PgBouncer port).
* `JWT_SECRET`: High-entropy key used to sign session cookies.
* `AI_PROVIDER=google`
* `IMAGE_PROVIDER=google`
* `CORS_ALLOWED_ORIGINS`: Points to customer landing domains.

### Frontend
* `VITE_API_URL`: Points to API Gateway (e.g. `https://api.najmah.com`).

### Python AI Service
* `GEMINI_API_KEY`: Secure API key for Gemini.

---

## 2. Secrets & Logs Sanitization
* **No hardcoded secrets:** Checked. All private credentials, passwords, and tokens are fetched from environment variables.
* **Log Scrubbing:** Pino JSON logging layers scrub sensitive properties (like passwords, authorization tokens, or JWTs) from standard stdout outputs to prevent leaks in logs.
