# Customer Production Deployment & DevOps Guide — Najmah AI Platform (v1.0.0)

This document provides comprehensive technical instructions for deploying, orchestrating, securing, and backing up the **Najmah AI Platform (v1.0.0)** in production containerized environments.

---

## 1. Production Architecture Overview

Najmah runs as containerized services orchestrated by Docker Compose behind a high-performance NGINX reverse proxy with SSL termination:

```
                       [ Public Client Traffic (Port 443 / SSL) ]
                                           │
                                           ▼
                               [ NGINX Proxy Container ]
                                (najmah-proxy / Port 80, 443)
                                           │
          ┌────────────────────────────────┴────────────────────────────────┐
          │ (Static Web Fallback)                                           │ (/api/* Proxy)
          ▼                                                                 ▼
┌───────────────────┐                                            ┌─────────────────────┐
│ Frontend Container│                                            │ Backend Core        │
│ (najmah-frontend) │                                            │ (najmah-backend)    │
└───────────────────┘                                            └──────────┬──────────┘
                                                                            │ (Internal network)
                                                                            ▼
                                                                 ┌─────────────────────┐
                                                                 │ Python AI Service   │
                                                                 │ (najmah-ai-service) │
                                                                 └─────────────────────┘
```

---

## 2. Docker Container Setup & Orchestration

Najmah contains three production `Dockerfile` manifests and two Docker Compose orchestration manifests:

* **Frontend SPA:** `Dockerfile` (Root) — Multi-stage Node 20 build compiling React/Vite assets served via NGINX.
* **Backend Gateway:** `backend-core/Dockerfile` — Multi-stage Node 20 build for NestJS Monolith API Gateway (`PORT 3000`).
* **Python AI Microservice:** `ai-service/Dockerfile` — Python 3.11-slim container running FastAPI Uvicorn (`PORT 8000`).

### Production Deployment Execution Flow

1. **Copy Environment File:**
   ```bash
   cp .env.production.example .env.production
   # Edit .env.production with production database secrets and Gemini API key
   ```

2. **Launch Container Suite:**
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.production.yml --env-file .env.production up --build -d
   ```

3. **Verify Container Health & Logs:**
   ```bash
   docker-compose ps
   docker-compose logs -f --tail=50
   ```

---

## 3. NGINX Reverse Proxy & SSL Setup (Certbot)

The platform routes all incoming web requests through the `najmah-proxy` container using `docker/nginx/nginx.conf`.

### Installing Free Let's Encrypt SSL Certificates with Certbot:

```bash
# 1. Install Certbot on Host
sudo apt-get update && sudo apt-get install -y certbot

# 2. Obtain SSL Certificate
sudo certbot certonly --webroot -w ./docker/certbot/www -d najmah.example.com -d api.najmah.example.com

# 3. Mount Certificates into NGINX Volume
# Certbot places keys in /etc/letsencrypt/live/najmah.example.com/
# docker-compose.yml automatically mounts ./docker/certbot/conf into /etc/letsencrypt
```

---

## 4. Container Health Probes & Monitoring

Production container orchestrators (Kubernetes, AWS ECS, Docker Swarm, Docker Compose) monitor service health using standard HTTP probes:

| Target Component | Probe Type | Endpoint URL | Expected HTTP Code |
| :--- | :--- | :--- | :---: |
| **Frontend SPA** | Liveness | `http://localhost:80/` | `200 OK` |
| **Backend Core** | Liveness | `http://localhost:3000/api/v2/health/live` | `200 OK` |
| **Backend Core** | Readiness | `http://localhost:3000/api/v2/health/ready` | `200 OK` |
| **AI Service** | Readiness | `http://localhost:8000/health` | `200 OK` |
| **NGINX Proxy** | Global Health | `http://localhost:80/health` | `200 OK` |

---

## 5. Automated Database Backup & Restore

Automated shell scripts are provided under `scripts/` for PostgreSQL database maintenance:

### Creating a Database Backup
```bash
# Set connection string in environment
export SUPABASE_DB_URL="postgresql://postgres:secret@db.example.com:5432/postgres"

# Execute backup (creates timestamped compressed file in ./backups/)
./scripts/backup-database.sh ./backups
```

### Restoring a Database Backup
```bash
export SUPABASE_DB_URL="postgresql://postgres:secret@db.example.com:5432/postgres"

# Execute restoration script
./scripts/restore-database.sh ./backups/najmah_db_20260722_120000.sql.gz
```
