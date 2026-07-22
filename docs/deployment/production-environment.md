# Production Environment Specifications (production-environment.md)

This manual specifies the operational requirements and runtime parameters for the Najmah v1.0.0 platform in production environments.

---

## 1. CORS & Origin Policies
In production, fail-closed CORS policies are enforced. The backend refuses to start without a valid `CORS_ALLOWED_ORIGINS` value:
- Allowed origins must explicitly target the custom customer production domain (e.g. `https://app.najmah.com`).
- Direct wildcards (`*`) are disallowed.

---

## 2. Secure HTTP Headers
The backend incorporates `helmet` to inject headers:
* **Content Security Policy (CSP):** Limits scripts execution scopes.
* **Strict-Transport-Security (HSTS):** Enforces HTTPS for all client calls.
* **X-Frame-Options:** Denies clickjacking attempts.

---

## 3. Cookie Safety Settings
Session credentials utilize JWTs stored in secure client cookies:
* `Secure`: Enforces HTTPS-only transmissions.
* `HttpOnly`: Prevents cookie access via JavaScript scripts (preventing XSS data theft).
* `SameSite=Lax`: Standard cross-site request protection.
