# Export Center & Customer Download Experience (export-center.md)

This document details the Export Center architecture, downloadable asset structures, API specifications, and customer download flows for Najmah v1.0.0.

---

## 1. Architecture Overview

```
 [Frontend Story Detail View]
            │
            ├── GET /stories/:id/export/pdf
            ├── GET /stories/:id/export/audio
            └── GET /stories/:id/export/zip
            │
            ▼
 [NestJS API Gateway Monolith]
            │
            ├── IllustratedStoryExportService
            │      ├── PdfExportService (pdf-lib engine)
            │      └── JSZip Dynamic Bundler
            │
            ▼
 [Supabase Storage Bucket: `pdf_exports`] ──► 24h Signed Download URL
```

---

## 2. API Endpoints

### 1. Export PDF Book
* **Endpoint:** `GET /api/v2/stories/:id/export/pdf` / `POST /api/v2/stories/:id/export/pdf`
* **Guards:** `AuthGuard` (Requires JWT Cookie session).
* **Response Payload:**
  ```json
  {
    "status": "COMPLETED",
    "download_url": "https://<supabase-storage-url>/pdf_exports/story-123.pdf?token=..."
  }
  ```

### 2. Export Audio Narration (MP3)
* **Endpoint:** `GET /api/v2/stories/:id/export/audio` / `POST /api/v2/stories/:id/export/audio`
* **Guards:** `AuthGuard`.
* **Response Payload:**
  ```json
  {
    "status": "COMPLETED",
    "download_url": "https://<supabase-storage-url>/audio/story-123.mp3?token=...",
    "filename": "story.mp3"
  }
  ```

### 3. Export Complete ZIP Bundle
* **Endpoint:** `GET /api/v2/stories/:id/export/zip` / `POST /api/v2/stories/:id/export/zip`
* **Guards:** `AuthGuard`.
* **Response Payload:**
  ```json
  {
    "status": "COMPLETED",
    "download_url": "https://<supabase-storage-url>/pdf_exports/story-123-bundle.zip?token=...",
    "filename": "story-bundle.zip"
  }
  ```

---

## 3. PDF Document Structure
* **Cover Page:**
  - Story Title (HelveticaBold 24pt)
  - Dedicated Child Name (e.g. `Created for: Little Reader`)
  - Language and Creation Date metadata
  - High-resolution Cover Illustration
  - Branding Footer (`Najmah AI Story Platform`)
* **Story Content Pages (1..N):**
  - Top Header: Story Title & Page Number (`Page X of Y`)
  - Scene Illustration Image (scaled proportionally within print margins)
  - Multiline Story Text (wrapped with clean font rendering)
  - Branding Footer (`Najmah AI Story Platform`)

---

## 4. ZIP Package Structure
The ZIP archive is dynamically generated on-demand containing:
```
story-bundle.zip
├── story.pdf          (High-resolution print-ready PDF book)
├── story.mp3          (Narration audio, if generated)
├── cover.png          (Cover page illustration)
├── page-1.png         (Page 1 scene illustration)
├── page-2.png         (Page 2 scene illustration)
└── metadata.json      (Story metadata JSON payload)
```

### Example `metadata.json`
```json
{
  "storyId": "story-uuid-123",
  "title": "The Boy and the Golden Falcon",
  "childName": "Youssef",
  "language": "ar",
  "pages": 5,
  "createdAt": "2026-07-22T10:00:00.000Z",
  "illustrations": [
    { "pageNumber": 1, "imageUrl": "https://.../page-1.png" },
    { "pageNumber": 2, "imageUrl": "https://.../page-2.png" }
  ],
  "audio": "https://.../story.mp3",
  "version": "1.0.0"
}
```

---

## 5. Error Handling & HTTP Status Codes
* `404 Not Found`: Returned when the target `storyId` is missing or when `audio` narration has not been generated yet.
* `403 Forbidden` / `404 Not Found`: Returned when attempting to export a story belonging to another user.
* `500 Internal Server Error`: Returned when storage upload or signed URL generation fails.
