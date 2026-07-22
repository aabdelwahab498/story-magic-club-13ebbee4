# Migration Risk Assessment

## Technical Risks
- **Session Desynchronization**: Supabase uses its own internal state (`supabase.auth.getSession()`) in the browser. NestJS relies on HTTP-only cookies. Care must be taken to completely remove `supabase-js` auth event listeners to prevent the frontend from falling out of sync with the backend HttpOnly cookie state.
- **State Management**: The Lovable frontend currently mixes component-level fetching and `supabase.from()`. The introduction of an API client and potentially React Query introduces a new state paradigm.

## Breaking Change Risks
- **Orchestrator Contract**: NestJS orchestration expects a precise `StoryRequest` payload. The frontend currently triggers the Edge function directly. If the frontend payload does not exactly match the new NestJS DTOs, story generation will fail.
- **Role-Based Access Control (RBAC)**: The frontend previously relied on Supabase RLS policies enforced directly on the DB. NestJS endpoints must correctly map and enforce these via Guards, otherwise users might face 403 Forbidden errors for resources they own.

## UI Risks
- **Loading States**: The transition from `supabase.from()` to Axios + NestJS might slightly alter the latency characteristics or error shapes, leading to unhandled UI loading spinners or silent errors if not mapped properly.
- **Visual Changes**: Following the UI Protection Rule, NO UI should change. However, component refactoring to swap data hooks poses a minor risk of accidentally altering classes or layout.

## API Contract Risks
- **Error Formats**: Supabase errors follow a specific format (`{ error: { message, code } }`). The NestJS API will return standard HTTP Exceptions (e.g., `{ statusCode, message }`). The API client must normalize these to prevent frontend crashes.
- **Data Shapes**: NestJS DTOs might return data shapes slightly different from raw Supabase `select(*)` queries, particularly regarding related tables (e.g., `profiles` vs `user_metadata`).

## Testing Requirements
- **Mock Service Worker (MSW)**: Since we are moving to HTTP APIs, testing should shift from mocking `supabase` to intercepting network requests with MSW.
- **Auth Flow Testing**: The login/register and session hydration flow must be thoroughly tested with unit tests to ensure the HTTP-only cookie approach functions seamlessly for the user.
