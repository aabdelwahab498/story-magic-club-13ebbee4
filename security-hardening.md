# Security Hardening Documentation (security-hardening.md)

This document establishes the security architecture and hardening standards for the Najmah AI Platform.

---

## 1. Authentication Architecture (JWT & JWKS)

To ensure secure session handling and protect downstream services, token verification uses a two-tier verification pipeline in `SupabaseService.verifyToken`:

1. **Local Claims Validation (Tier 1 - Fail-Fast):**
   - Decodes the token payload locally without network roundtrips.
   - Rejects the token immediately if it is expired (`exp`), if the audience (`aud`) does not match `'authenticated'` (or the configured `JWT_AUDIENCE`), or if the issuer (`iss`) is invalid.
2. **Signature Verification (Tier 2 - Cryptographic check):**
   - Passes valid tokens to the Supabase Auth SDK (`client.auth.getUser`) to verify the signature cryptographically.

---

## 2. Input Validation (Fail-Closed)

All input payloads sent to Backend Core controllers are validated globally in `main.ts` using NestJS `ValidationPipe` configured for strict whitelisting:
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
);
```
- **Whitelisting:** Automatically strips fields that do not have active `class-validator` decorators in the matching DTO.
- **Fail-Closed:** Rejects payloads (`400 Bad Request`) that contain unknown, un-whitelisted keys.

---

## 3. Database Row-Level Security (RLS)

All database tables are governed by strict PostgreSQL Row-Level Security policies to enforce tenant isolation:

| Database Table | RLS Enabled | Policies | Risk Level | Access Description |
| :--- | :--- | :--- | :--- | :--- |
| `user_credits` | Yes | SELECT (users can read own); ALL (service_role only) | Low | Users can only see their credit balance. |
| `credit_transactions` | Yes | SELECT (users can read own); ALL (service_role only) | Low | Only owner can read, only backend can write. |
| `usage_events` | Yes | SELECT (users can read own); ALL (service_role only) | Low | Audit events are isolated per owner. |
| `subscription_plans` | Yes | SELECT (authenticated role); ALL (admin role) | Low | Static plans are read-only to users. |
| `plan_features` | Yes | SELECT (authenticated role); ALL (admin role) | Low | Read-only properties for authenticated users. |
| `plan_limits` | Yes | SELECT (authenticated role); ALL (admin role) | Low | Read-only limits for authenticated users. |
| `user_subscriptions` | Yes | SELECT (owner only); ALL (admin role) | Low | Active status viewable by owner. |
| `payment_customers` | Yes | SELECT (owner / admin); ALL (service_role only) | Low | Integrations are private to user. |
| `payment_transactions` | Yes | SELECT (owner / admin); ALL (service_role only) | Low | Transaction logs are private. |
| `ai_usage_costs` | Yes | SELECT (admin only); ALL (service_role only) | Low | Highly private cost analytics. |

---

## 4. Encryption Architecture (BYOK AES-256-GCM)

The Bring Your Own Key (BYOK) architecture provides a foundation for database column encryption:
- **Algorithm:** Authenticated Symmetric Encryption (`aes-256-gcm`).
- **Nonces:** Unique 12-byte initialization vectors (IVs) generated via cryptographically secure random bytes (`crypto.randomBytes`) for every payload.
- **Authentication Tags:** An authentication tag is stored alongside the cipher to prevent ciphertext tempering.
- **Key Versioning:** Stored values are tagged with key versions (e.g., `v1`) to facilitate future key rotations without service disruption.

---

## 5. Security Headers (Helmet)

Production environment security headers are enabled in the API gateway via NestJS `helmet` middleware:
- **Strict-Transport-Security (HSTS):** Enforces HTTPS connections.
- **X-Frame-Options (Frameguard):** Mitigates Clickjacking by denying frame embeds.
- **X-Content-Type-Options:** Prevents MIME-type sniffing (`nosniff`).
- **Referrer-Policy:** Hides referrer headers during external navigation.
- **X-Powered-By:** Hidden to prevent server fingerprinting.
