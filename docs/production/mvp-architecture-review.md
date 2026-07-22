# Najmah MVP Architecture Review

## 1. Current System Architecture
The Najmah MVP Version 1.0 has completed its migration from a Supabase direct-access monolith to a modern, decoupled three-tier architecture:
- **Frontend**: React SPA (Vite)
- **Backend API Gateway**: NestJS core orchestrator
- **AI Microservice**: FastAPI Python service (Hybrid AI Gateway)
- **Database / Auth**: Supabase PostgreSQL and Supabase Auth (acting as the identity provider).

## 2. Frontend Architecture
- **Framework**: React 18, TypeScript, Vite 5
- **State Management**: TanStack Query (React Query) for server state caching and synchronization, React Context for local auth state.
- **Styling**: Tailwind CSS, shadcn/ui components.
- **Routing**: React Router DOM (with lazy-loaded routes for optimal initial chunk size).
- **Security**: Supabase JS client usage is now limited strictly to public non-sensitive components. Authentication interactions have been fully migrated to communicate directly with the NestJS API.

## 3. Backend Architecture (NestJS Core)
- **Framework**: NestJS (TypeScript)
- **Role**: Serves as the primary API gateway, abstracting Supabase from the frontend.
- **Modules**:
  - `AuthModule`: Handles cookie-based sessions, Supabase JWT minting, and authentication guard injection.
  - `StoriesModule`: Manages story generation state, persistence, and CRUD operations.
  - `ChildrenModule`: Manages child profiles and capabilities mapping.
- **Validation**: Global `ValidationPipe` ensures all incoming DTOs are sanitized and typed.

## 4. AI Execution Flow
The system utilizes a Hybrid AI Gateway architecture:
1. **Request**: The frontend sends a `POST /stories` request.
2. **Orchestration**: The NestJS `StoryGenerationOrchestrator` generates a unique UUID and inserts a pending story record.
3. **Delegation**: NestJS issues a request to the FastAPI AI microservice.
4. **Processing**: FastAPI communicates with OpenAI/Gemini providers using fallback patterns, enforcing prompt safety and JSON formatting.
5. **Callback/Return**: The generated story is processed, inserted into the Supabase database via the backend admin credentials, and the frontend polls the `GET /stories/:id/status` endpoint for completion.

## 5. Authentication Flow
- **Pattern**: HttpOnly Cookie Session
- **Execution**: The React frontend sends email/password to `POST /auth/login` on the NestJS API. NestJS communicates with Supabase Auth, retrieves a session JWT, and returns it to the frontend via a strictly configured `HttpOnly, Secure, SameSite=Lax` cookie.
- **Guards**: Every protected NestJS route utilizes an `AuthGuard` that extracts the HttpOnly cookie, verifies the JWT signature, and attaches the user context to the request.

## 6. Data Flow
`[React UI] <--(REST/JSON)--> [NestJS API] <--(REST/HTTP)--> [FastAPI / AI Providers]`
`                                  |`
`                                  v`
`                           [Supabase DB]`
- **Frontend**: The MVP frontend bypasses Supabase completely for all core user journeys (Children, Stories).
- **Backend**: NestJS utilizes Supabase Admin API keys (`SERVICE_ROLE`) mapped strictly within backend limits, exposing only safe operations to the user token via RLS bypass or explicit backend validation.

## 7. External Dependencies
- **Supabase**: PostgreSQL DB and Identity Provider.
- **AI Providers**: OpenAI/Gemini (via Hybrid Gateway).
- **Vite/React**: SPA ecosystem.

## 8. Known Limitations
- **Polling over WebSockets**: Story generation status relies on short polling rather than WebSockets or SSE (Server-Sent Events) to maintain simplicity for the MVP.
- **Admin Monolith**: The `Admin.tsx` dashboard on the frontend still accesses Supabase directly for rapid prototyping. This was explicitly excluded from the MVP phase migration.
- **Error Propagation**: AI Gateway failures correctly mark story status as `FAILED`, but fine-grained error visibility (e.g., token limits vs safety violations) is partially obscured from the end-user.
