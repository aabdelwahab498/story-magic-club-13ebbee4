# Najmah MVP v1.0 Rollback Plan

This document outlines the strategy for backing out of an unsuccessful v1.0 deployment in a production environment.

## Rollback Strategy Overview
The Najmah architecture relies on state synchronization across three layers. A rollback must be executed in the exact reverse order of data dependency: Frontend -> API Gateway -> Database.

## 1. Frontend Rollback
- **Static Assets**: If a severe bug is discovered in the React frontend (e.g., routing failure, blank screens):
  1. Login to the deployment provider (e.g., Vercel / Netlify / AWS Amplify).
  2. Locate the "Deployments" tab.
  3. Select the immediate prior stable build (Pre-v1.0.0).
  4. Click "Promote to Production" or "Rollback".
  5. The CDN will instantly purge the current V1 assets and serve the previous build.

## 2. Backend & AI Provider Rollback
- **API Discrepancies**: If the backend introduces a fatal error (e.g., NestJS crashing on startup, FastAPI timing out instantly):
  1. Access the container orchestration platform (e.g., Docker / AWS ECS / Render).
  2. Rollback the Docker image tag from `v1.0.0` to the last known stable tag (e.g., `v0.9.x`).
  3. Verify `GET /health` returns `200 OK`.

## 3. Database Rollback Considerations
- **No Destructive Migrations in V1**: The v1.0 schema changes primarily involved *adding* the `children` relationship arrays and altering RLS policies, rather than dropping legacy columns. 
- **Restoration**: If database corruption occurs:
  1. Access the Supabase Project Dashboard.
  2. Navigate to Database -> Backups.
  3. Select the Point-in-Time Recovery (PITR) snapshot immediately preceding the migration window.
  4. Initiate the restore. **Warning**: This will result in data loss for any user accounts or stories generated *after* the backup timestamp. Communicate this risk heavily before executing.

## 4. Immediate Mitigation (Without Rollback)
- If the OpenAI gateway fails systematically, update the FastAPI environment variables to force traffic to the Gemini provider (`PRIMARY_LLM=gemini`) rather than attempting a full code rollback.
