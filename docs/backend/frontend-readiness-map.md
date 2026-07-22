# Frontend Readiness Map

| Frontend Feature | Backend Endpoint | Controller | DTO | Ready? | Notes |
|------------------|------------------|------------|-----|--------|-------|
| **Login Form** | `POST /auth/login` | `AuthController` | `LoginDto` | Yes | Sets `HttpOnly` cookie |
| **Register Form** | `POST /auth/register` | `AuthController` | `RegisterDto` | Yes | Sets `HttpOnly` cookie |
| **Logout** | `POST /auth/logout` | `AuthController` | None | Yes | Clears cookie |
| **App Initialization** | `GET /auth/me` | `AuthController` | None | Yes | Validates session via Guard |
| **Child Profiles View** | `GET /api/v2/users/me/children` | `ChildrenController` | None | Yes | RLS abstracted by service layer |
| **Add Child Form** | `POST /api/v2/users/me/children` | `ChildrenController` | `CreateChildProfileDto` | Yes | RLS abstracted |
| **Story Library View**| `GET /api/v2/stories` | `StoriesController` | None | Yes | Validated response mapped to frontend format |
| **Story Generation Trigger**| `POST /api/v2/stories` | `StoriesController` | `CreateStoryRequestDto` | Yes | Correctly hooks into `StoryGenerationOrchestrator` |
| **Story Details View**| `GET /api/v2/stories/:id` | `StoriesController` | None | Yes | Full hydrated response object |
