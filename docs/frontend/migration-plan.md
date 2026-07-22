# Sprint 10.0 — Frontend Architecture Migration Foundation

The objective of this sprint is to cleanly migrate the MVP frontend boundaries to rely entirely on the NestJS backend, removing direct dependencies on Supabase Auth and Database queries for MVP flows. The UI will remain visually unchanged.

## 1. Current Supabase Dependencies
The Lovable frontend currently imports `supabase` from `src/integrations/supabase/client` in over 60 files. The dependencies can be classified into:
- **Authentication:** `supabase.auth.onAuthStateChange`, `supabase.auth.getSession()`, `signInWithPassword`, `signUp`, `signOut`.
- **Direct DB Queries:** `supabase.from(...)` (e.g., `child_profiles`, `stories`, `bedtime_schedules`, etc.).
- **Edge Functions:** `supabase.functions.invoke(...)` (e.g., illustrations, admin overrides).
- **Real-time:** `supabase.channel(...)`.

## 2. Files Affected
**MVP Files (In Scope for Migration):**
- **Auth:** `src/hooks/useAuth.tsx`, `src/pages/Auth.tsx`, `src/api/auth.ts`, `src/components/ProtectedRoute.tsx`
- **API Client:** `src/api/client.ts`
- **Children:** `src/lib/childProfilesApi.ts`, `src/api/children.ts`
- **Stories:** `src/lib/aiStoryApi.ts`, `src/lib/trialStoryApi.ts`, `src/api/stories.ts` (Already partially mapped, but direct DB logic remains)

**Future / Non-MVP Files (Out of Scope):**
- **Admin flows:** `src/lib/adminApi.ts`, `src/pages/admin/*`
- **Bedtime/Parent features:** `src/lib/parentApi.ts`
- **Billing/Subscriptions:** `src/lib/subscriptionApi.ts`
- **Integrations:** `src/lib/n8nStoryApi.ts`
- **Edge Functions / Audio:** `src/lib/storyTtsApi.ts`

## 3. Migration Strategy
1. **Phase 2: Create API Client Layer:** Install `axios`. Refactor `src/api/client.ts` to export an Axios instance configured with `withCredentials: true` and the backend base URL. Centralize error handling here.
2. **Phase 3: Authentication Migration:** Refactor `src/api/auth.ts` to hit the new NestJS `/auth/*` endpoints. Rewrite `useAuth.tsx` to rely on `/auth/me` on mount instead of `supabase.auth.onAuthStateChange`. Update `Auth.tsx` to post credentials to NestJS.
3. **Phase 4 & 5: Data Access Migration & Cleanup:** Audit MVP data files (`childProfilesApi.ts`, `aiStoryApi.ts`, etc.) and replace any remaining `supabase.from` calls with API endpoint wrappers.
4. **Phase 6: State Management:** Ensure all migrated API calls are wrapped in `useQuery` / `useMutation` from `@tanstack/react-query`.
5. **Phase 7: Testing:** Implement tests for the Auth flow using Mock Service Worker (MSW) or Jest mocks to ensure UI stability without real backend calls.

## 4. New API Mapping
| Entity | Frontend Action | New NestJS Endpoint |
|---|---|---|
| Auth | Register | `POST /auth/register` |
| Auth | Login | `POST /auth/login` |
| Auth | Logout | `POST /auth/logout` |
| Auth | Session | `GET /auth/me` |
| Children | List Children | `GET /children` (via `/users/me/children`) |
| Children | Create Child | `POST /children` |
| Stories | Create Story | `POST /stories` |
| Stories | Get Story | `GET /stories/:id` |

## 5. Risks
- **Session Restoration:** Relying purely on an `HttpOnly` cookie means the frontend must wait for `/auth/me` to resolve before rendering protected routes. This may introduce a brief loading state.
- **Lost Edge Functions:** If MVP flows rely heavily on Edge Functions directly (e.g., classic illustrations generation), we must either mock them, map them to NestJS, or document them as Future.
- **Real-time Breaking:** Removing Supabase Auth will instantly break `supabase.channel()` connections, even for non-MVP flows. We will add a caveat/workaround or document this as an accepted temporary degradation until WebSockets are built.

## 6. Out-of-scope Areas
All visual UI redesigns, Admin Dashboards, Payments, Personalization, Subscriptions, WebSockets, and Edge-function heavy features (Audio, PDF) are **explicitly out of scope** and will retain their current `supabase` dependencies (which will be clearly documented).
