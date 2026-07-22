# Customer Installation Guide — Najmah AI Platform (v1.0.0)

Welcome to the **Najmah AI Story Platform** technical installation guide. This document provides clear, step-by-step instructions for installing and running the Najmah platform in a development or staging environment.

---

## 1. Prerequisites

Before installing Najmah, ensure your machine or virtual host meets the following software requirements:

* **Node.js:** `v18.x LTS` or `v20.x LTS` (Node.js 20 recommended).
* **npm:** `v9.x` or higher.
* **Python:** `3.10` or higher (Python 3.11/3.12 supported).
* **Database:** PostgreSQL `14+` or Supabase project instance with Row-Level Security (RLS) enabled.
* **Docker & Docker Compose (Optional):** Docker `24+` and Compose `v2+` for containerized setups.
* **Git:** `2.30+`.

---

## 2. Step-by-Step Installation

### Step 1: Clone the Repository
```bash
git clone https://github.com/aabdelwahab498/story-magic-club.git
cd story-magic-club
```

### Step 2: Install Dependencies

#### Frontend & Workspace Core:
```bash
npm install
```

#### Backend Core (NestJS):
```bash
cd backend-core
npm install
cd ..
```

#### Python AI Service (FastAPI):
```bash
cd ai-service
python -m venv venv

# On Windows (PowerShell):
.\venv\Scripts\activate

# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
cd ..
```

---

## 3. Environment Variable Configuration

Copy the example environment templates to initialize configuration files:

```bash
# Root environment file
cp .env.example .env

# Backend core environment file
cp backend-core/.env.example backend-core/.env

# AI microservice environment file
cp ai-service/.env.example ai-service/.env
```

*For complete details on every environment variable, see [environment-variables.md](file:///d:/AI-Projects/Najmah-AI-Platform/docs/customer/environment-variables.md).*

---

## 4. Database Setup & Schema Initialization

1. Connect to your PostgreSQL database instance or Supabase project.
2. Run database migration scripts located under `supabase/migrations/` to initialize tables (`profiles`, `children`, `stories`, `ai_story_history`, `story_media`, `character_bibles`, `ai_audit_logs`).
3. Ensure storage buckets are initialized:
   - `pdf_exports`
   - `audio`
   - `illustrations`
   - `avatars`

---

## 5. Starting System Microservices

To run Najmah locally in development mode, open 3 terminal sessions:

### Terminal 1: Backend Core (NestJS Gateway)
```bash
cd backend-core
npm run start:dev
# Running on http://localhost:3000
```

### Terminal 2: AI Microservice (FastAPI)
```bash
cd ai-service
# Activate virtual environment first
.\venv\Scripts\activate  # (Windows) or source venv/bin/activate (Linux/macOS)
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# Running on http://localhost:8000
```

### Terminal 3: Frontend Client (React / Vite)
```bash
npm run dev
# Running on http://localhost:5173
```

---

## 6. Verifying Installation

Open your browser and navigate to `http://localhost:5173`. You will see the Najmah landing page and login portal.

To verify service health probes:
- Backend Health: `http://localhost:3000/api/v2/health/ready`
- AI Service Health: `http://localhost:8000/health`
