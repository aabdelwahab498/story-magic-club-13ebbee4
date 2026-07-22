# Deployment Guide (deployment-guide.md)

This runbook provides step-by-step instructions to compile, configure, and launch the Najmah AI Platform in production environments.

---

## 1. System Topology Overview

```
 [Client Browser]
        │ (HTTPS)
        ▼
 [Cloud Load Balancer]
        │
        ├──────────────────────────┐
        ▼                          ▼
 [NestJS API Instance 1]    [NestJS API Instance 2]
        │ (Intranet REST)          │ (Intranet REST)
        ├──────────────────────────┼──────────────────────┐
        ▼                          ▼                      ▼
 [Python AI FastAPI]        [Supabase PostgreSQL]   [Supabase S3 Bucket]
```

---

## 2. Step-by-Step Deployment Steps

### Step 1: Clone & Configure Environments
1. Clone the repository to the production server.
2. Initialize environment configurations:
   ```bash
   cp backend-core/.env.example backend-core/.env
   cp ai-service/.env.example ai-service/.env
   cp .env.example .env
   ```
3. Fill in real production API keys, Supabase URLs, and secure keys in all `.env` files.

### Step 2: Build and Run Services (via Docker)
1. Build and boot all service containers:
   ```bash
   docker-compose -f docker-compose.dev.yml up --build -d
   ```
2. Verify that both the NestJS API gateway (port `3000`) and the Python AI service (port `8000`) are running.

### Step 3: Run Database Migrations
1. Use Supabase CLI to apply schema changes to production:
   ```bash
   supabase db push
   ```
2. Confirm migrations apply without errors and RLS remains active.

### Step 4: Build and Deploy Frontend SPA
1. Install client dependencies:
   ```bash
   npm install
   ```
2. Compile production-ready static assets:
   ```bash
   npm run build
   ```
3. The build output will be stored in `dist/`. Deploy this directory to a high-availability CDN (e.g. Vercel, Netlify, or AWS CloudFront).
