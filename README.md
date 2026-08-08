
# Najmah AI Story Platform (v1.0.0) 
<img width="1439" height="813" alt="Screenshot 2026-08-07 223227" src="https://github.com/user-attachments/assets/4bb010a6-6d83-406f-9c33-0720508765fa" />
<img width="1230" height="654" alt="Screenshot 2026-08-07 223330" src="https://github.com/user-attachments/assets/f2daaab0-e55d-4f8e-9480-6f1086ef211c" />
<img width="1367" height="570" alt="Screenshot 2026-08-07 223455" src="https://github.com/user-attachments/assets/74acea22-0082-4ff1-9f9f-396a88bc7051" />
<img width="1363" height="742" alt="Screenshot 2026-08-07 223615" src="https://github.com/user-attachments/assets/f28f0370-a0d3-44ac-b8c9-5b00b3248b8f" />


**Najmah** is an enterprise-grade, AI-powered story creation platform designed for children, parents, and educators. It integrates personalized storytelling, Social-Emotional Learning (SEL) frameworks, multi-language support (English, Arabic, German, French, Italian, Spanish with full RTL rendering), synthetic voice narrations, custom scene illustrations, and print-ready PDF/ZIP exports.

---

## 1. System Architecture

```
                       [ Client Web Browser / PWA ]
                                   │
                                   │ (HTTPS REST API / HttpOnly Cookies)
                                   ▼
                   ┌───────────────────────────────┐
                   │  NestJS API Monolith Gateway  │
                   │        (backend-core)         │
                   └───────────────┬───────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │ (Internal REST Call)    │ (Database / Storage)    │ (Prometheus Scraper)
         ▼                         ▼                         ▼
┌──────────────────┐    ┌────────────────────┐    ┌─────────────────────┐
│ Python AI Service│    │ Supabase Postgres  │    │ Prometheus Telemetry│
│   (FastAPI)      │    │  & Object Storage  │    │   & Grafana Dash    │
└────────┬─────────┘    └────────────────────┘    └─────────────────────┘
         │
         ▼
 ┌───────────────┐
 │ Google Gemini │
 └───────────────┘
```

### Architecture Highlights
* **Decoupled Monolith Gateway:** The NestJS core acts as the single entry point for client authentication, RBAC authorization, credit management, usage tracking, and Export Center execution.
* **FastAPI AI Microservice:** Dedicated Python service executing prompt templates, 4-act story planning, writer composition, quality scoring (`>=18/25`), and retry loops.
* **Database & Row-Level Security (RLS):** Supabase PostgreSQL database enforces strict tenant isolation via RLS policies and `has_role` database guards.
* **Export Center Engine:** Asynchronously compiles print-ready PDFs, stitched MP3 narrations, and dynamic ZIP bundles containing `metadata.json`, PDF, MP3, cover, and page illustrations.

---

## 2. Technology Stack

* **Frontend:** React 18, TypeScript, Vite 5, Tailwind CSS 3, shadcn/ui primitives, TanStack Query v5, i18next (6 locales: `en`, `ar`, `de`, `fr`, `it`, `es`).
* **Backend Core:** NestJS 10, Class-Validator, Zod, Pino JSON Logging, Prometheus Client Metrics, Helmet Security.
* **AI Service:** FastAPI, Python 3.10+, Pydantic v2, Google Gemini API SDK.
* **Data & Storage:** Supabase PostgreSQL, Supabase S3 Storage Buckets (`pdf_exports`, `audio`, `illustrations`, `avatars`).
* **Packaging & Tools:** PDF-Lib, JSZip, Workbox Service Worker (PWA), Docker & Docker Compose.

---

## 3. Local Development Setup

### Prerequisites
* Node.js v18 LTS or v20 LTS
* Python 3.10+
* Git & npm

### Step 1: Clone and Environment Setup
```bash
git clone https://github.com/aabdelwahab498/story-magic-club.git
cd story-magic-club

# Configure Root, Backend, and AI Environment files
cp .env.example .env
cp backend-core/.env.example backend-core/.env
cp ai-service/.env.example ai-service/.env
```

### Step 2: Start Backend Core (NestJS)
```bash
cd backend-core
npm install
npm run start:dev
# Listens on http://localhost:3000
```

### Step 3: Start AI Microservice (FastAPI)
```bash
cd ../ai-service
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# Listens on http://localhost:8000
```

### Step 4: Start Frontend SPA (Vite)
```bash
cd ..
npm install
npm run dev
# Listens on http://localhost:5173
```

---

## 4. Production Deployment & Docker Setup

To build and run all services using Docker Compose:

```bash
docker-compose -f docker-compose.dev.yml up --build -d
```

### Build Targets
* **Frontend SPA:** `npm run build` generates optimized assets in `dist/` with PWA precache assets (142 files).
* **Backend Gateway:** `npm run build` inside `backend-core` compiles NestJS into `dist/main.js`.

---

## 5. Key Environment Variables

### Backend Core (`backend-core/.env`)
| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Listening HTTP port | `3000` |
| `NODE_ENV` | Environment profile (`development` / `production`) | `development` |
| `SUPABASE_URL` | Supabase API endpoint | Required |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase private admin key | Required |
| `CORS_ALLOWED_ORIGINS` | Allowed origins | `http://localhost:5173,http://localhost:3000` |
| `PYTHON_AI_URL` | FastAPI service URL | `http://localhost:8000` |

### AI Microservice (`ai-service/.env`)
| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Listening HTTP port | `8000` |
| `GEMINI_API_KEY` | Google Gemini API Key | Required |

---

## 6. Testing & Verification Commands

### Backend Core Unit Tests
```bash
cd backend-core
npm test
```

### AI Service Tests
```bash
cd ai-service
.\venv\Scripts\pytest
```

### Frontend Tests & Type Checking
```bash
npm test
npx tsc --noEmit
```

---

## 7. Operational Observability & Health Probes

* **Health Endpoints:**
  * Liveness: `GET /api/v2/health/live`
  * Readiness: `GET /api/v2/health/ready`
* **Metrics Scraper Endpoint:**
  * `GET /metrics` (Exposes Prometheus metrics for request counts, SQL latencies, and AI pipeline durations).
* **Structured Logs:** Containers emit Pino JSON logs to stdout with automatic sanitization of sensitive keys (tokens, secrets, passwords).

---

## 8. License

Proprietary — All rights reserved. Najmah AI Platform Team.
