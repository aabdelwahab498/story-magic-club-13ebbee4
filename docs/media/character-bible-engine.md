# Character Bible Engine

## Purpose
The Character Bible Engine is a foundational layer of the Najmah AI Media architecture designed to guarantee deterministic visual consistency for characters across multiple AI-generated illustrations. It extracts, versions, and maintains core visual identities.

## Data Model
- **`character_bibles` Table**: Stores the source of truth for a character's physical description, age, gender, role, personality, and deterministic visual traits (e.g., hair color, clothing style).
- **Versioning**: Each character reference includes a version integer. As the story progresses or as the character evolves, the engine can create new versions.

## Generation Lifecycle
1. **Extraction**: When a story is illustrated for the first time, the `CharacterExtractor` deterministically identifies characters and their core descriptions from the text.
2. **Persistence**: The extracted characters are saved to the database.
3. **Prompt Injection**: The `IllustrationPromptBuilder` maps these strict visual descriptions into the final image generation prompt.

## Future AI Provider Integration
By maintaining a strict database record of physical appearances, future integration with LoRA (Low-Rank Adaptation) and specific prompt-tuning techniques for Stable Diffusion or Midjourney becomes trivial. The provider simply reads the `reference_prompt` or `visual_traits`.
