# Customer Guide: Generating & Exporting Your First Story

This guide details how to generate personalized AI stories, illustrate scenes, synthesize narration audio, view stories in the Story Reader, and download print-ready PDF/ZIP exports.

---

## 1. Generating a New Story

1. Navigate to **Story Creator** or click **Create Story** from the dashboard.
2. Select a target **Child Profile** (e.g. `Youssef`).
3. Configure story parameters:
   - **Theme / Prompt:** (e.g., `A brave young explorer who discovers a hidden garden`).
   - **SEL Goal:** (e.g., `Overcoming fear of the dark` / `Empathy & kindness`).
   - **Language:** Select target language (English, Arabic with full RTL rendering, German, etc.).
4. Click **Generate Story**.

### AI Workflow Execution
Behind the scenes, Najmah executes a 4-step AI generation pipeline:
1. **Planner Agent:** Creates a 4-act structural blueprint.
2. **Writer Agent:** Writes localized story prose matching the child's age group.
3. **Validator Agent:** Scratches profanity, checks reading level, and ensures quality scoring `>=18/25`.
4. **Library Storage:** Stores story chapters in the database and renders the story in your library.

---

## 2. Generating Scene Illustrations & Narration Audio

Once the story text is ready:

1. Click **Generate Illustrations** inside the Story Reader view.
   - The AI Character Bible extracts key physical attributes (hair, eyes, clothing style) to maintain character visual consistency across scenes.
2. Click **Generate Narration Audio**.
   - Synthetic voice engines generate clear page-by-page audio narrations.

---

## 3. Reading Stories in the Interactive Reader

1. Click on any story in **My Stories Library** to open the interactive Story Reader.
2. Features:
   - **Font Scaling:** Adjust text sizing for younger readers.
   - **RTL Rendering:** Native right-to-left layout alignment for Arabic stories.
   - **Audio Sync:** Click **Play Narration** to listen to the audio track while turning pages.

---

## 4. Exporting Stories (Customer Download Center)

To download your story as physical media or offline bundles:

1. In the Story Reader view, click the **Export / Download** dropdown menu.
2. Select your desired format:
   - **Download PDF:** Generates a print-ready PDF book featuring cover page, dedicated child name, title, date, page illustrations, page numbers, and branding footer.
   - **Download Audio (MP3):** Downloads the complete narration audio file (`story.mp3`).
   - **Download ZIP Bundle:** Downloads a packaged `.zip` archive containing:
     - `story.pdf`
     - `story.mp3`
     - `cover.png`
     - `page-1.png`, `page-2.png`, ...
     - `metadata.json`
