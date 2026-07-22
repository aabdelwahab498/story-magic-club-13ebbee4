# Najmah AI Platform - API Mapping

This document maps the frontend actions to the new NestJS backend API endpoints.

## Authentication (Migrated)

| Action | HTTP Method | Endpoint | Description |
|---|---|---|---|
| Registration | `POST` | `/auth/register` | Creates a new user |
| Login | `POST` | `/auth/login` | Authenticates and returns `HttpOnly` session cookie |
| Current Session | `GET` | `/auth/me` | Retrieves the current user's profile and RBAC roles |
| Logout | `POST` | `/auth/logout` | Invalidates session and clears `HttpOnly` cookie |

## Children (Migrated Data Access Layer)

| Action | HTTP Method | Endpoint | Description |
|---|---|---|---|
| List Children | `GET` | `/users/me/children` | Retrieves all children for current user |
| Get Child | `GET` | `/users/me/children/:id` | Retrieves a specific child |
| Create Child | `POST` | `/users/me/children` | Creates a new child profile |
| Update Child | `PATCH` | `/users/me/children/:id` | Updates a child profile |
| Delete Child | `DELETE`| `/users/me/children/:id` | Deletes a child profile |

## Stories (Migrated Data Access Layer)

| Action | HTTP Method | Endpoint | Description |
|---|---|---|---|
| List All User Stories| `GET` | `/stories` | Retrieves all stories owned by user |
| List Child Stories | `GET` | `/stories/child/:childId` | Retrieves all stories for a specific child |
| Get Story | `GET` | `/stories/:id` | Retrieves a specific story by ID |
| Create Story | `POST` | `/stories` | Dispatches request to orchestrator |
| Update Status | `PATCH` | `/stories/:id/status`| Updates the generation status |
| Retry Story | `POST` | `/stories/:id/retry` | Retries a failed story generation |
| Delete Story | `DELETE`| `/stories/:id` | Deletes a story |

## Out-of-Scope (Still using Supabase direct access)
*   **Admin Dashboard Data**: Users, Metrics, AI Analytics
*   **Blog Engine**: Posts management
*   **Store/Cart**: Cart items, Orders
*   **Parent Features**: Bedtime Schedules, Goals tracking
*   **Story Downloads**: PDF Generation, Audio Generation (Edge Functions)
*   **Realtime**: `supabase.channel()`
