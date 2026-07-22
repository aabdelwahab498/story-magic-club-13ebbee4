# MVP Migration Scope

The goal of Sprint 10 is to migrate the MVP-critical frontend domains away from Supabase direct access to the new NestJS backend architecture.

## MVP Migration Required (In-Scope)

The following components and domains MUST be migrated to the NestJS backend to launch the MVP:

- **Authentication / Users**: Registration, Login, Logout, Session retrieval, Password Resets.
- **Children**: Fetching, adding, editing, and deleting child profiles (`childProfilesApi.ts`).
- **Stories**: Triggering generation via the AI Orchestrator, fetching stories, story status polling, library lists.
- **Story Details**: Fetching the generated text and metadata for a specific story.

## Future Migration (Out-of-Scope)

The following features can remain on direct Supabase connectivity or be temporarily disabled/mocked until future sprints address them:

- **Illustrations**: `illustrate-story` Edge Function.
- **Audio TTS**: `narrate-story` Edge Function.
- **PDF Generation**: Product export Edge Function.
- **Admin Dashboard**: `Admin*.tsx` pages relying heavily on direct DB queries.
- **E-Commerce/Store**: `Store.tsx` and cart management.
- **Blog Engine**: `blogAdminApi.ts` and related blog submission flows.
- **Advanced Realtime**: `supabase.channel()` implementations for tracking long-running batch jobs or collaborative features.
