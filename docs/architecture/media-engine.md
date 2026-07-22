# Najmah AI Media Engine Architecture

## 1. Overview
The Najmah AI Media Engine is a decoupled subsystem designed to extend story generation with multimodal assets (Illustrations, Audio/TTS, PDF Generation). It operates alongside the MVP story text generation flow, ensuring that media generation failures or latencies do not block core text delivery.

## 2. Component Responsibilities
- **MediaController**: Exposes REST endpoints (`POST /stories/:id/media`, `GET /media/:id/status`) to the React frontend.
- **MediaService**: Handles database persistence (`story_media`), orchestrates requests, and maintains the state machine (`PENDING` -> `PROCESSING` -> `COMPLETED`/`FAILED`).
- **MediaGateway**: Acts as the abstraction router. It interprets the media type request and delegates to the appropriate `IMediaProvider`.
- **IMediaProvider**: The strict interface that all underlying AI SDKs (e.g., OpenAI DALL-E, Google Imagen, ElevenLabs) must implement.
- **Queue/Workers (Future)**: Will consume `MediaJob` objects for heavy asynchronous operations, utilizing Redis/BullMQ.

## 3. Data Flow
1. **Request**: The frontend issues `POST /stories/:id/media` containing the `type` (e.g., `ILLUSTRATION`).
2. **Persistence**: `MediaService` inserts a `PENDING` record into the `story_media` table and returns the `mediaId` to the client.
3. **Execution**: `MediaService` asynchronously invokes `MediaGateway.generate()`.
4. **Provider Interaction**: The gateway invokes the specific `IMediaProvider`.
5. **Callback**: Upon success/failure, the `story_media` record is updated with the artifact `url` or error state.
6. **Polling**: The frontend polls `GET /media/:id/status` until completion.

## 4. Future Provider Strategy
The architecture relies on the Strategy Pattern. We can swap out the Mock provider for real providers without altering the `MediaService`:
- `DalleIllustrationProvider`
- `ImagenIllustrationProvider`
- `EdgeTtsAudioProvider`

## 5. Cost Considerations
Media generation (especially images and high-fidelity TTS) is computationally expensive. The Media Engine prepares for cost controls via:
- Isolation from text generation (only generated on explicit request or specific queue triggers).
- Strict idempotency (checking the database before re-triggering).

## 6. Async Processing Strategy
Currently, execution is handled natively via Node.js async/await to unblock the HTTP response. In Phase 2, this will be migrated to an external Redis-backed job queue (BullMQ), enabling retry mechanisms and concurrency limits that API providers often demand.
