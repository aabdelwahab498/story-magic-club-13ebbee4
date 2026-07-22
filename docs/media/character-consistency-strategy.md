# Character Consistency Strategy

## Core Challenge
When generating multiple illustrations for a story, AI image models (like Midjourney, DALL-E, or Imagen) naturally vary the appearance of characters. For a children's story, it is unacceptable for the main character to change hair color, clothing style, or facial structure from page to page.

## The Solution: Najmah Character Bible Engine
The Najmah Character Bible solves this by intercepting the text generation output and explicitly constructing a strict physical identity before ANY images are requested.

### How Consistency Works Today (MVP Foundation)
1. **Extraction**: The system parses the AI story for characters.
2. **Standardization**: It assigns strict traits (e.g., "curly black hair", "green eyes", "yellow dress", "Pixar 3D style").
3. **Injection**: Every illustration prompt generated for the story is forced to include this exact identical string description.

### Future Roadmap: Zero-Shot Consistency via Stable Diffusion / LoRA
While prompt injection achieves ~80% consistency, the ultimate goal is 100% face-locking.
1. **Image Embeddings (IP-Adapter)**: We will generate ONE master portrait for the character. That portrait is passed as an image embedding (IP-Adapter/Reference Image) to all subsequent generation calls.
2. **LoRA Generation**: For heavy users or custom branded characters, we can train a small, cheap LoRA on a few images of the character and inject that LoRA into the inference pipeline.
3. **Seed Locking**: Using the exact same generation seed across pages while heavily controlling the noise schedule allows for extreme temporal consistency.

## Character Evolution
If a character changes clothing or ages up, the Character Bible simply increments the `version` integer, creating a new `CharacterBible` row linked to the same story but with updated visual traits.
