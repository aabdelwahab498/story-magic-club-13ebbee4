# Missing Backend Capabilities Report

This report outlines frontend requirements that currently rely on Supabase Edge Functions or direct Supabase integration, but do not yet have corresponding robust implementations in the new NestJS backend.

## 1. Post-Registration Hooks (Welcome Email)
- **Required functionality**: Sending a welcome email after successful registration.
- **Why frontend needs it**: The frontend currently triggers this via `supabase.functions.invoke("send-welcome-email")` post-signup. The frontend shouldn't be responsible for dispatching welcome emails directly.
- **Suggested backend endpoint**: Emit an event within the `POST /auth/register` flow on NestJS to handle this asynchronously, completely hiding it from the frontend.
- **Priority**: High (MVP scope)

## 2. Advanced Audio / TTS Generation
- **Required functionality**: Generating audio narration for stories.
- **Why frontend needs it**: Currently hits `supabase.functions.invoke('narrate-story')`. It should be handled by the FastAPI AI Gateway.
- **Suggested backend endpoint**: `POST /stories/:id/audio` (Proxied via NestJS to FastAPI)
- **Priority**: Low (Future scope)

## 3. Product Export (PDF generation)
- **Required functionality**: Generating beautiful PDFs of stories for download/printing.
- **Why frontend needs it**: Hits `supabase.functions.invoke('export-product-story-pdf')`.
- **Suggested backend endpoint**: `POST /stories/:id/export/pdf`
- **Priority**: Low (Future scope)

## 4. Admin Dashboard Analytics & Management
- **Required functionality**: Broad aggregation of user statistics, model usage, agent tracking.
- **Why frontend needs it**: Admin pages use complex `supabase.from()` filters across many tables.
- **Suggested backend endpoint**: Dedicated `GET /admin/*` endpoints in NestJS.
- **Priority**: Low (Future scope)

## 5. E-commerce / Cart Management
- **Required functionality**: Tracking user cart items, store inventory.
- **Why frontend needs it**: `Store.tsx` and `cartApi.ts` hit Supabase DB directly.
- **Suggested backend endpoint**: Dedicated `GET /cart` / `POST /cart` module in NestJS.
- **Priority**: Low (Future scope)
