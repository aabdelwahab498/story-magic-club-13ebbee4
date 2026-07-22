# Supabase Dependency Inventory

## A) Authentication
| File Path | Function/Component | Supabase Feature Used | Purpose | MVP / Future | Recommended Replacement | Complexity |
|-----------|---------------------|-----------------------|---------|--------------|--------------------------|------------|
| `src/hooks/useAuth.tsx` | `AuthProvider` | `supabase.auth.getSession`, `onAuthStateChange`, `signOut` | Manages global auth state & RBAC | MVP | Replace with NestJS `/auth/me` on mount | High |
| `src/pages/Auth.tsx` | `Auth` | `signInWithPassword`, `signUp`, `invoke('claim-admin')` | Main login/register forms | MVP | Use `authApi.login` / `register` | Medium |
| `src/pages/AdminAuth.tsx` | `AdminAuth` | `signInWithPassword` | Admin login | Future | Use `authApi.login` | Medium |
| `src/pages/ForgotPassword.tsx` | `ForgotPassword` | `resetPasswordForEmail` | Password reset flow | MVP | New NestJS `/auth/reset-password` | Low |
| `src/pages/ResetPassword.tsx` | `ResetPassword` | `updateUser` | Handle recovery token | MVP | New NestJS `/auth/update-password` | Low |

## B) Database Queries
| File Path | Function/Component | Supabase Feature Used | Purpose | MVP / Future | Recommended Replacement | Complexity |
|-----------|---------------------|-----------------------|---------|--------------|--------------------------|------------|
| `src/lib/childProfilesApi.ts` | (indirectly via client) | `supabase.from('child_profiles')` (was used previously) | CRUD Children | MVP | `GET/POST /users/me/children` | Low |
| `src/api/stories.ts` | (indirectly via client) | `supabase.from('stories')` | CRUD Stories | MVP | `GET/POST /stories` | Low |
| `src/pages/StoryDetail.tsx` | `StoryDetail` | `supabase.from('stories')` | Fetch single story details | MVP | `GET /stories/:id` | Medium |
| `src/pages/Admin*.tsx` | Multiple components | `supabase.from(...)` | Admin CRUD (products, models, agents) | Future | NestJS Admin APIs | High |
| `src/lib/cartApi.ts` | `useAddToCart` | `supabase.from('cart_items')` | E-commerce features | Future | NestJS E-commerce APIs | Medium |

## C) Edge Functions
| File Path | Function/Component | Supabase Feature Used | Purpose | MVP / Future | Recommended Replacement | Complexity |
|-----------|---------------------|-----------------------|---------|--------------|--------------------------|------------|
| `src/lib/aiStoryApi.ts` | `generateClassicIllustrations`| `supabase.functions.invoke` | AI Image Generation | Future | Route via FastAPI Gateway | High |
| `src/lib/storyTtsApi.ts` | `generateStoryAudio` | `supabase.functions.invoke` | AI Audio Generation | Future | Route via FastAPI Gateway | High |
| `src/pages/Auth.tsx` | `handleSignUp` | `supabase.functions.invoke('send-welcome-email')` | Welcome Email | MVP | Move to backend Post-Register Hook | Low |
| `src/pages/AIStoryteller.tsx` | `generateStory` | `supabase.functions.invoke('generate-story')` | Story generation engine trigger | MVP | Route via NestJS `POST /stories` | High |

## D) Realtime Channels
| File Path | Function/Component | Supabase Feature Used | Purpose | MVP / Future | Recommended Replacement | Complexity |
|-----------|---------------------|-----------------------|---------|--------------|--------------------------|------------|
| `src/components/story/BatchDownloadDialog.tsx` | `BatchDownloadDialog` | `supabase.channel()` | Live progress for batch exports | Future | NestJS WebSockets/SSE | Medium |

## E) Storage
| File Path | Function/Component | Supabase Feature Used | Purpose | MVP / Future | Recommended Replacement | Complexity |
|-----------|---------------------|-----------------------|---------|--------------|--------------------------|------------|
| `src/hooks/useSecureUpload.ts` | `uploadFile` | `supabase.storage.from` | Uploading custom avatars/images | Future | NestJS secure upload endpoints | Medium |
