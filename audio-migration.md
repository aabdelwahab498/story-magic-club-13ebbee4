# Najmah AI Story Platform – Audio Migration Documentation

---

## Overview

As part of **Sprint 13.2 — Phase 6: Audio Migration & Media Provider Unification**, we migrated the legacy Supabase Deno Edge functions responsible for Text-To-Speech (TTS) / Narration generation into the NestJS Backend Core gateway. 

This establishes a clean, provider-agnostic layer for audio operations, mirroring the design patterns used for Illustration Providers, while preserving full backward compatibility.

---

## 1. Provider Architecture

All audio generation now relies on a modular, interface-driven provider architecture:

* **IAudioProvider Interface (`IAudioProvider`):** Exposes `name` and `generate(storyId, metadata)`. Located in [audio-provider.interface.ts](file:///d:/AI-Projects\Najmah-AI-Platform\backend-core\src\modules\media\providers\audio\audio-provider.interface.ts).
* **Supabase Edge Adapter Provider (`EdgeAudioProvider`):** Executes backend-to-backend invocation of the legacy `narrate-story-edge` edge function via Supabase Admin Client. Located in [edge-audio.provider.ts](file:///d:/AI-Projects\Najmah-AI-Platform\backend-core\src\modules\media\providers\audio\edge-audio.provider.ts).
* **Mock Provider (`MockAudioProvider`):** Returns a local/sandbox placeholder audio file (`SoundHelix` track) for local testing without depleting actual AI synthesis quotas. Located in [mock-audio.provider.ts](file:///d:/AI-Projects\Najmah-AI-Platform\backend-core\src\modules\media\providers\audio\mock-audio.provider.ts).
* **Audio Provider Factory (`AudioProviderFactory`):** Resolves the target provider dynamically at runtime based on the `AUDIO_PROVIDER` environment variable (defaults to `edge`). Located in [audio-provider.factory.ts](file:///d:/AI-Projects\Najmah-AI-Platform\backend-core\src\modules\media\providers\audio\audio-provider.factory.ts).

---

## 2. API Endpoints

The new NestJS controller routes are registered under `api/v2/media` and mapped in [audio.controller.ts](file:///d:/AI-Projects\Najmah-AI-Platform\backend-core\src\modules\media\audio.controller.ts):

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v2/media/stories/:storyId/audio` | Triggers background narration generation for a story |
| `GET` | `/api/v2/media/stories/:storyId/audio` | Fetches the current narration status and audio URL |
| `POST` | `/api/v2/media/stories/:storyId/audio/retry` | Re-triggers/retries narration generation for a failed story |
| `DELETE` | `/api/v2/media/stories/:storyId/audio` | Deletes story narration references and records |
| `POST` | `/api/v2/media/tts` | Synthesizes dynamic, short-form TTS (e.g., narrator previews) |

---

## 3. Database State and Tables

* **`ai_story_history`:** Updates the `audio_url` column with the final generated MP3 URL upon completion.
* **`story_media`:** Tracks the processing lifecycle of media generation jobs. It inserts/updates records with `type = 'AUDIO'` and `status` toggles (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`).

---

## 4. Frontend Integration

All direct calls from the client to Supabase functions have been migrated to point to NestJS versioned gateway endpoints:

* **API Client Layer:** Frontend routes are encapsulated in [audio.api.ts](file:///d:/AI-Projects\Najmah-AI-Platform\src\api\audio.api.ts).
* **React Query Hooks:** Wrapped hooks (`useStoryAudio`, `useGenerateAudio`, `useRetryAudio`, `useDeleteAudio`) reside in [useStoryAudio.ts](file:///d:/AI-Projects\Najmah-AI-Platform\src\hooks\useStoryAudio.ts) and automatically handle background status polling (every 3 seconds while pending).
* **Story Reader View:** The narration player controls in [MyAiStoryDetail.tsx](file:///d:/AI-Projects\Najmah-AI-Platform\src\pages\MyAiStoryDetail.tsx) render context-aware layouts (loading spinners, play/download buttons, and retry buttons).
