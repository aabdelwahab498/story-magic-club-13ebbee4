# Najmah AI Media Engine Roadmap

## Phase 1: Architecture & Foundation (Sprint 11.0 - Current)
- Establish the `story_media` database schema.
- Implement the `MediaModule` in NestJS.
- Create the strict `IMediaProvider` abstraction boundary.
- Implement `MockMediaProvider` to validate system flow without incurring API costs.
- Inject the `MediaGateway` router.

## Phase 2: Real Image Provider Integration
- Integrate an actual text-to-image API (e.g., Google Imagen 3 or OpenAI DALL-E 3).
- Implement `ImagenIllustrationProvider` adhering to `IMediaProvider`.
- Enhance the `StoryGenerationOrchestrator` to optionally trigger illustration generation upon story completion.
- Create a localized Prompt Builder (translating core SEL intents into visually striking prompt structures).

## Phase 3: Audio Narration Engine (TTS)
- Implement `EdgeTtsAudioProvider` or ElevenLabs integration.
- Break the returned 4-act story JSON down into synchronous narration blocks.
- Introduce the `MediaJob` and `MediaTask` queues natively using Redis/BullMQ to handle concurrent long-running audio generation tasks.

## Phase 4: Interactive Media & Print
- **PDF Generation**: Compile the generated text and generated illustrations into a beautifully formatted, downloadable PDF tailored for physical printing.
- **Interactive Story UI**: Transition the React `<ReadingMode>` component to optionally play the generated audio in sync with the text chunks.
