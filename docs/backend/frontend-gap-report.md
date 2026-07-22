# Frontend Gap Report

This document highlights gaps between what the Frontend expects and what the Backend currently provides.

## Missing Endpoints
- **Password Reset Flow**: `POST /auth/reset-password` and `POST /auth/update-password` are completely missing from `AuthController`. The frontend relies on Supabase `resetPasswordForEmail` and `updateUser` for this.
  - *Priority*: Post-MVP
  - *Status*: Deferred Feature. While present in the current Lovable frontend, self-service password recovery is not strictly required to launch the initial Najmah MVP. Users can be manually assisted by admins during the closed beta.
- **Admin Dashboard Endpoints**: None of the dashboard analytics, model trackers, agent trackers, etc., are implemented in NestJS.
  - *Priority*: Low (Out of MVP Scope, currently handled via direct Supabase querying).

## Missing DTO Fields
- No critical missing DTO fields were detected for the MVP scope. The `CreateChildProfileDto` and `CreateStoryRequestDto` map correctly to the required MVP inputs.

## Breaking Contracts
- The frontend currently receives raw Supabase `Error` objects (`{ error: { message, code } }`). NestJS throws HTTP Exceptions natively shaped as `{ statusCode, message, error }`. The frontend Axios client must be prepared to catch and standardize these error payloads seamlessly or UI elements will fail silently.

## Security Configurations
- The CSRF token strategy is not natively explicit yet in the Auth Controller although `HttpOnly` cookies are configured securely via `lax` `SameSite` settings. The frontend must be able to securely connect.
