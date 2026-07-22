# Najmah MVP Security Review

## 1. Authentication Security

### HttpOnly Cookies
- **Implementation**: The application now strictly utilizes `HttpOnly` cookies for all session handling.
- **Secure Configuration**: The `Secure` flag is enforced in production environments, ensuring cookies are only transmitted over encrypted HTTPS connections.
- **SameSite Configuration**: Cookies are configured with `SameSite=Lax` (or `Strict` where appropriate), mitigating Cross-Site Request Forgery (CSRF) vulnerabilities.
- **Session Persistence**: Sessions are maintained exclusively by the backend validating the HttpOnly cookie via the Supabase Auth API, ensuring stateless but persistent authentication on the client side.
- **Unauthorized Handling**: 401 Unauthorized responses correctly trigger a client-side context invalidation, gracefully redirecting the user to the `/auth` login page and clearing application state.

## 2. API Security

### Authorization & Guards
- **Implementation**: Every protected NestJS endpoint is guarded by a global or controller-scoped `AuthGuard`.
- **Validation**: The `AuthGuard` extracts the JWT from the `HttpOnly` cookie and cryptographically verifies it against the Supabase project configuration before permitting execution.
- **Role-Based Access Control (RBAC)**: Currently leverages the standard Supabase user ID and Role assignments. Future iterations will utilize specific claims.

### Input Validation & Sanitization
- **DTO Validation**: Incoming requests to the NestJS API are strictly validated using `class-validator` and `class-transformer` embedded within standard Data Transfer Objects (DTOs).
- **Global Pipes**: A global `ValidationPipe` ensures that any payload not conforming to the DTO structure is immediately rejected with a 400 Bad Request.
- **Sanitization**: All input strings, especially prompt material for the AI Gateway, are passed through backend sanitization logic before evaluation by the LLM providers.

### Error Exposure
- **Information Disclosure**: Backend exceptions are caught via a global `AllExceptionsFilter`. This prevents stack traces or sensitive database query failures from leaking to the frontend.
- **Sanitized Responses**: General errors map to user-friendly messages (e.g., "An error occurred while generating the story") while maintaining detailed logs in the backend.

## 3. Frontend Security

### Storage Best Practices
- **No JWT in localStorage**: The explicit Supabase client instances in the frontend have been stripped of authentication capabilities for MVP flows. No JWT or `supabase.auth.token` is ever persisted in `localStorage` or `sessionStorage`.
- **No Secrets in Frontend**: The frontend only holds public API keys (e.g., `VITE_SUPABASE_ANON_KEY`). All sensitive Service Role keys and OpenAI/Gemini credentials reside strictly in the backend `.env` configuration.
- **API URL Configuration**: The frontend accesses the backend via the `VITE_API_URL` environment variable, which securely defaults to `https://api.najmah.com` or local environments, preventing hardcoded endpoints from leaking or breaking.
