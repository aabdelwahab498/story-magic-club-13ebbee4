# Najmah MVP Deployment Checklist

Before deploying the Najmah MVP to a production environment (e.g., Vercel, AWS, DigitalOcean), complete the following checks across all infrastructure layers.

## 1. Backend (NestJS & FastAPI)
- [ ] **Environment Variables**: Ensure production `.env` contains:
  - `NODE_ENV=production`
  - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (Verify they point to the **Production** Supabase project, NOT staging).
  - `OPENAI_API_KEY` and `GEMINI_API_KEY` with correct billing limits.
  - `SESSION_SECRET` (Secure, 64+ character random string).
  - `CORS_ORIGIN` (Set to the exact production frontend domain).
- [ ] **Database Setup**: Apply all Supabase migrations to the production database via the Supabase CLI (`supabase db push`).
- [ ] **Health Checks**: Configure the hosting provider (e.g., AWS ALB) to ping `GET /health` to verify service uptime.
- [ ] **Build Verification**: Run `npm run build` natively on the server or verify the Docker image compiles without TypeScript errors.

## 2. Frontend (React / Vite)
- [ ] **Environment Variables**: 
  - Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the production project.
  - Set `VITE_API_URL` to point to the production NestJS backend domain (e.g., `https://api.najmah.com`).
- [ ] **Production Build**: Execute `npm run build`. Ensure the output `dist` folder is uploaded/served via the CDN (e.g., Vercel or Cloudfront).
- [ ] **Service Worker**: Verify the `PWA` manifest and `sw.js` are correctly configured to cache the production assets.

## 3. Infrastructure & Security
- [ ] **HTTPS / TLS**: Ensure SSL certificates are active for both the frontend domain and the backend API domain. (Required for `HttpOnly, Secure` cookies to function).
- [ ] **DNS Records**: Verify `A` and `CNAME` records correctly route to the frontend CDN and backend Load Balancer.
- [ ] **Supabase Auth Configuration**: 
  - Add the production frontend URL to the **Site URL** and **Additional Redirect URLs** inside the Supabase Authentication dashboard.

## 4. Monitoring Preparation
- [ ] **Logs**: Ensure backend logs are successfully captured and retained (e.g., via CloudWatch, Datadog, or Vercel Logging).
- [ ] **Error Tracking**: (If applicable) Verify Sentry or equivalent error tracking correctly captures unhandled frontend and backend exceptions.
- [ ] **Billing Limits**: Set hard budget limits in OpenAI, Google AI Studio, and Supabase to prevent unexpected cost overruns during the Beta phase.
