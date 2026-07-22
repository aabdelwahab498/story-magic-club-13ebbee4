# MVP v1.0 Production Configuration Checklist

## Environment Separation
The architecture enforces strict separation across three environments:
1. **Development:** Local or isolated remote databases for testing and feature development.
2. **Staging:** A mirror of production used for QA and integration testing. Must use a separate Supabase project.
3. **Production:** Live environment facing real users.

## 1. Backend (`backend-core/.env`)
For each environment, ensure the following variables are correctly scoped:

- [ ] `NODE_ENV`: `development`, `staging`, or `production`.
- [ ] `PORT`: `3000` (or target port).
- [ ] `SUPABASE_URL`: The environment-specific Supabase project URL (`https://<project>.supabase.co`).
- [ ] `SUPABASE_SERVICE_ROLE_KEY`: The environment-specific Supabase Service Role Key. **CRITICAL: NEVER expose this to the frontend.**
- [ ] `FRONTEND_URL`: The frontend URL matching the environment (e.g., `http://localhost:5173`, `https://staging.najmah.ai`, `https://najmah.ai`), used for CORS configuration.
- [ ] `GEMINI_API_KEY`: A valid Google Gemini API key. Ensure cost limits are applied per environment.
- [ ] `GEMINI_MODEL`: `gemini-1.5-pro` (or equivalent stable version).
- [ ] `GEMINI_TIMEOUT`: `15000` (15 seconds).
- [ ] `JWT_SECRET`: For internal token verification (must differ between staging and production).

## 2. Frontend (`.env`)
The frontend is a Vite + React application.

- [ ] `VITE_SUPABASE_URL`: The environment-specific Supabase project URL.
- [ ] `VITE_SUPABASE_ANON_KEY`: The environment-specific Supabase Anon Key.
- [ ] `VITE_BACKEND_URL`: The URL of the NestJS backend matching the environment (e.g., `https://api.najmah.ai`).

## 3. Database (Supabase)
- [ ] Ensure all migrations have been applied (`supabase db push` or equivalent CI/CD step).
- [ ] Verify that RLS is ENABLED on all tables (especially `story_requests`, `stories`, `child_profiles`).

## 4. Platform Services
- [ ] Verify CORS configurations match between frontend and backend.
- [ ] Verify OAuth providers (if applicable, e.g., Google Sign-In) are configured with the production redirect URIs in the Supabase Dashboard.
