# Domain & Security Configuration

For a production deployment, secure domain mapping and HTTPS configuration are critical.

## 1. Domain Setup
1. **Frontend**: If deploying to Vercel, go to **Settings > Domains** and add your custom domain (e.g., `najmah.ai` and `www.najmah.ai`). Vercel will automatically provision SSL certificates.
2. **Backend**: If deploying to Railway, go to **Settings > Networking > Custom Domains** and configure your API subdomain (e.g., `api.najmah.ai`). Ensure SSL is provisioned.

## 2. HTTPS Enforcement
Both Vercel and Railway force HTTPS by default. Do not allow HTTP connections.

## 3. CORS Configuration
Ensure your NestJS backend explicitly allows the frontend domain in `.env.production`:
```bash
CORS_ALLOWED_ORIGINS="https://www.najmah.ai,https://najmah.ai"
```
Do NOT use wildcard `*` for CORS in production.

## 4. Secure Cookies & Tokens
The backend is stateless and issues JWT tokens via headers. If you decide to move to HTTP-only cookies in the future, ensure the `Secure` and `SameSite=Strict` attributes are set.

## 5. Secret Management
Never commit `.env.production` or `.env` files to git. Use the built-in Secrets Managers in Vercel and Railway to inject the environment variables at build/runtime.
