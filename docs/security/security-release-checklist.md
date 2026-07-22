# Security Release Checklist (security-release-checklist.md)

This checklist verifies authentication flow safety, API inputs validation, and secret sanitization layers before release.

---

## 1. Authentication & Cookie Safety
- [x] **Secure JWT Cookie Storage:** Enforced with `HttpOnly`, `SameSite=Lax`, and `Secure` attributes.
- [x] **Token Issuer Validation:** Explicit checking of JWT signatures, algorithms, and expiration properties.
- [x] **RBAC Guards Integration:** NestJS class guards validate user context claims before route execution.

---

## 2. API Gateway Security
- [x] **Input DTO Sanitization:** Validated via NestJS `ValidationPipe` leveraging class-validators.
- [x] **Sensitive Data Scrubbing:** Logs check and strip sensitive keys (e.g. passwords, bearer headers).
- [x] **Fail-Closed CORS Policy:** Starts only if `CORS_ALLOWED_ORIGINS` is configured with allowed domains.

---

## 3. Operations & Auditing
- [x] **Audit Log Capture:** Critical transaction activities are logged to `ai_audit_logs`.
- [x] **No hardcoded secrets:** Checked. All API keys, passwords, and private tokens are isolated in env files.
