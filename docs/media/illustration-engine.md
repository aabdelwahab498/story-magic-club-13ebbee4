# Najmah Illustration Engine

## 1. Architecture
The Illustration Engine operates as a sub-domain within the MediaModule. It translates abstract AI text generations into deterministic visual scenes, constructing highly structured prompts tailored for image generation APIs.

**Flow:**
1. **Scene Extraction**: Deterministically parse the `pages` array of a story into `Scene` objects (`pageNumber`, `environment`, `characters`, `emotion`).
2. **Prompt Building**: Translate `Scene` into a `StructuredPrompt` ensuring child-friendly stylistic enforcement.
3. **Provider Execution**: Hand off to `IMediaProvider.generateIllustration()`.

## 2. Data Flow
- `POST /stories/:id/media` triggers `MediaService`.
- If `type === 'ILLUSTRATION'`, `MediaService` invokes `IllustrationService`.
- `IllustrationService` fetches story pages from the database.
- Scenes are extracted and translated to prompts.
- `MockIllustrationProvider` (for now) fakes the generation process to bypass costs.
- The `url` and `IllustrationMetadata` are stored in the `story_media` database table.

## 3. Future Providers
The architecture strictly enforces `IMediaProvider`. To integrate a real API (e.g., Google Imagen 3 or OpenAI DALL-E 3), we only need to write a class that implements this interface.

## 4. Cost Strategy
- Illustration generation is heavily isolated from text generation. It only fires explicitly when requested.
- Caching logic (checking if a page already has an illustration) can easily be integrated into `IllustrationService`.

## 5. Character Consistency Roadmap
We have introduced the `CharacterReference` interface. 
In Sprint 12/13, this will evolve into the "Character Bible" system where an LLM agent strictly tracks physical descriptors across pages (e.g., "Main character is wearing a red cape") to enforce zero-shot visual consistency inside the prompt payloads.
