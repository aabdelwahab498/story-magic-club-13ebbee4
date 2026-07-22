# Najmah v1.0 AI Quality Audit (ai-quality-audit.md)

This report audits prompt construction, retry handling, and content moderation checks within the story and illustration generation pipelines.

---

## 1. Story Generation Pipeline
* **Prompt Abstraction:** Prompts are managed centrally to ensure consistent 4-act structural layouts (Hero, Mentor, Companion, SEL Outcome).
* **Story Validation:** All outputs are validated against the `GeneratedStory` schema, checking for missing titles, empty pages arrays, or invalid page formatting.
* **Moderation Filter:** Content check limits (via Lovable AI Gateway) block profanity, self-harm reference, and PII.
* **Scoring Rules:** Stories are checked for quality and must score 18/25 or higher to be marked publishable. Failed generations undergo a retry sequence (up to 2 attempts).

---

## 2. Illustration Engine
* **Character Bible Consistency:** Stores descriptions to preserve protagonist design parameters across scene generations.
* **Scene Extraction:** Custom parser isolates key scene settings, characters, and descriptions to compose illustration prompt segments.
* **Provider Options:** Supports Google DALL-E/Imagen and fallback Mock providers based on environment profiles.

---

## 3. Distributed Integration Preparation
* The orchestration layers are decoupled through the `JobDispatcher` interface, making future background worker queue integration straightforward.
