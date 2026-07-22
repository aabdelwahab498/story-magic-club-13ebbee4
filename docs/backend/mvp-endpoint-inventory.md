# MVP Endpoint Inventory

| Method | Path | Controller | DTO | Authentication Required | Authorization Required | Current Status |
|--------|------|------------|-----|-------------------------|------------------------|----------------|
| `POST` | `/auth/login` | `AuthController` | `LoginDto` | No (`@Public()`) | None | Ready |
| `POST` | `/auth/register` | `AuthController` | `RegisterDto` | No (`@Public()`) | None | Ready |
| `POST` | `/auth/logout` | `AuthController` | None | Yes | None | Ready |
| `GET` | `/auth/me` | `AuthController` | None | Yes | None | Ready |
| `GET` | `/api/v2/users/me/children` | `ChildrenController` | None | Yes | User Ownership | Ready |
| `POST` | `/api/v2/users/me/children` | `ChildrenController` | `CreateChildProfileDto` | Yes | User Ownership | Ready |
| `GET` | `/api/v2/users/me/children/:id` | `ChildrenController` | None | Yes | User Ownership | Ready |
| `PATCH` | `/api/v2/users/me/children/:id` | `ChildrenController` | `UpdateChildProfileDto` | Yes | User Ownership | Ready |
| `DELETE` | `/api/v2/users/me/children/:id`| `ChildrenController` | None | Yes | User Ownership | Ready |
| `GET` | `/api/v2/stories` | `StoriesController` | None | Yes | User Ownership | Ready |
| `POST` | `/api/v2/stories` | `StoriesController` | `CreateStoryRequestDto`| Yes | User Ownership | Ready |
| `GET` | `/api/v2/stories/child/:childId`| `StoriesController` | None | Yes | User Ownership | Ready |
| `GET` | `/api/v2/stories/:id` | `StoriesController` | None | Yes | User Ownership | Ready |
| `PATCH` | `/api/v2/stories/:id/status` | `StoriesController` | `UpdateStoryStatusDto` | Yes | User Ownership | Ready |
| `DELETE` | `/api/v2/stories/:id` | `StoriesController` | None | Yes | User Ownership | Ready |
| `POST` | `/api/v2/stories/:id/retry` | `StoriesController` | None | Yes | User Ownership | Ready |
