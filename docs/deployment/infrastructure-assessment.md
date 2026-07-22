# Production Infrastructure Assessment (infrastructure-assessment.md)

This document audits the deployment host characteristics, network mappings, and pooling prerequisites for the Najmah v1.0.0 platform.

---

## 1. Frontend SPA Deployment
* **Static Hosting:** Bundled assets are fully static HTML/JS/CSS files, optimized via Rollup manual chunking.
* **CDN Requirements:** Must be hosted on an edge CDN (AWS CloudFront, Vercel) enabling GZIP/Brotli compression to optimize initial rendering speed.
* **Asset Cache Headers:** Hashed asset bundles in `/assets/` should implement long-term caching (`Cache-Control: max-age=31536000, immutable`).

---

## 2. API Monolith Gateway (NestJS)
* **Node.js runtime:** Enforced version Node.js v18/20 LTS.
* **Runtime memory limits:** Max memory allocation set to `1.5 GB` (`node --max-old-space-size=1536`).
* **Environment variables validation:** Strict validation checks executed during NestJS container bootstrap. If required keys are missing, the server exits immediately.

---

## 3. Python AI Microservice (FastAPI)
* **Python Runtime:** Enforced version Python 3.10+.
* **Process Management:** Runs behind `Uvicorn` using multiple worker nodes (concurrency scale dependent on CPU availability).
* **Startup Command:** `uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4`.

---

## 4. Database & Storage Pool (Supabase)
* **PostgreSQL Schema:** Kept up-to-date with CLI migrations.
* **Connection Pooling:** PgBouncer or Supavisor connection pooling is highly recommended to regulate transaction limits.
* **Storage buckets:** Access to `illustrations`, `audio`, `avatars`, and `covers` is restricted by Postgres storage RLS policies.
