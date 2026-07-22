# Najmah AI Platform — Deployment Guide (deployment.md)

This guide documents the production deployment, containerization, environment configuration, and health monitoring for the Najmah AI Platform.

---

## 1. Environment Configuration

All settings must be configured via environment variables. Copy `.env.example` to `.env` in the respective project roots.

### Backend Core Configuration
The following variables are parsed and strictly validated by the NestJS ConfigModule using Zod at bootstrap:

| Environment Variable | Description | Validation Rule / Default |
| :--- | :--- | :--- |
| `PORT` | Listening port for NestJS server | Number, default: `3000` |
| `NODE_ENV` | Runtime stage | `development` \| `production` \| `test` |
| `SUPABASE_URL` | Supabase project API gateway URL | Required, Valid URL format |
| `SUPABASE_ANON_KEY` | Public anonymous key | Required, Min 10 chars |
| `SUPABASE_SERVICE_ROLE_KEY` | Private admin service-role key | Required, Min 10 chars |
| `CORS_ALLOWED_ORIGINS` | Comma-separated CORS allowed origins | Required, fail-closed |
| `REDIS_URL` | Redis server connection URL | Optional |
| `PYTHON_AI_URL` | FastAPI service gateway URL | Default: `http://localhost:8000` |
| `JWT_COOKIE_NAME` | Auth Cookie name | Default: `najmah_token` |
| `ILLUSTRATION_PROVIDER` | Illustration generator provider selection | `google` \| `mock`, default: `google` |
| `AUDIO_PROVIDER` | TTS Audio provider selection | `edge` \| `mock`, default: `edge` |
| `MEDIA_IMAGE_PROVIDER` | Media image engine provider selection | `google` \| `mock`, default: `mock` |
| `REQUEST_TIMEOUT` | Request timeout duration in ms | Default: `30000` |
| `RETRY_COUNT` | Number of retry attempts on provider fail | Default: `3` |
| `STORAGE_BUCKETS` | Active storage buckets | Default: `illustrations,audio,avatars,covers` |

### AI Service (Python) Configuration
Variables are strictly validated by Pydantic `BaseSettings` on startup:

| Environment Variable | Description | Default |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Google Gemini API key | **Required** (Fails fast if missing) |
| `PORT` | Listening port for Uvicorn | `8000` |
| `HOST` | Listening host interface | `0.0.0.0` |

---

## 2. Docker Containers

### Backend Core Dockerfile
Multi-stage build compiling NestJS TypeScript source to JavaScript and copying only the compiled build and production dependencies into the minimal Alpine runtime.
- **Dockerfile:** `backend-core/Dockerfile`
- **Build command:**
  ```bash
  docker build -t najmah-backend-core -f backend-core/Dockerfile ./backend-core
  ```

### AI Service Dockerfile
Uses a clean `python:3.11-slim` image, running dependencies from `requirements.txt` under a custom non-root system user.
- **Dockerfile:** `ai-service/Dockerfile`
- **Build command:**
  ```bash
  docker build -t najmah-ai-service -f ai-service/Dockerfile ./ai-service
  ```

---

## 3. Docker Compose Orchestration

Use `docker-compose.dev.yml` to spin up the local development stack containing Redis, AI Service, and Backend Core:

```bash
# Start all services in the background
docker compose -f docker-compose.dev.yml up --build -d

# Stop the stack and release volumes
docker compose -f docker-compose.dev.yml down -v
```

### Startup Sequence & Dependency Management
1. **Redis:** Starts first. Installs health checks (`redis-cli ping`).
2. **AI Service:** Starts next. Validates `GEMINI_API_KEY`. Installs health checks.
3. **Backend Core:** Starts once both Redis and AI Service are **healthy** (`service_healthy` condition).

---

## 4. Diagnostics & Health Endpoints

### Backend Core
- **GET `/api/v2/health`** / **GET `/api/v2/health/live`**: Liveness probes. Returns `200 OK` indicating the process is running.
- **GET `/api/v2/health/ready`**: Readiness probe. Performs downstream checks:
  1. Supabase ping select query.
  2. Redis ping (if configured).
  3. AI Service `/health` check.
  4. Google API key / provider configuration verification.

*Example response (Ready):*
```json
{
  "status": "ready",
  "database": "connected",
  "redis": "connected",
  "pythonAi": "connected",
  "providers": {
    "illustration": "google",
    "audio": "edge",
    "image": "mock",
    "googleApi": "configured"
  }
}
```

### AI Service
- **GET `/health`**: Returns Python microservice details:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "uptime": "45.2s",
  "provider_readiness": {
    "gemini": "ready"
  }
}
```

---

## 5. Graceful Shutdown

Both services listen to termination signals (`SIGTERM`, `SIGINT`).

- **Backend Core:** Releases Redis client connections via `ioredis` `.quit()` method and logs clean closure before NestJS exits.
- **AI Service:** Uses FastAPI `lifespan` handler to log shutdown event and safely release active model handlers.

---

## 6. Troubleshooting

### Startup Failures
- **Error:** `Invalid environment configuration` (NestJS) / `pydantic_core.ValidationError` (Python)
- **Resolution:** Verify that required environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CORS_ALLOWED_ORIGINS`, `GEMINI_API_KEY`) are present in your `.env` files or Docker environment.

### Connection timeouts
- **Error:** `pythonAi: unreachable` in readiness checks.
- **Resolution:** Verify network routing inside Docker Compose. Ensure `PYTHON_AI_URL` inside `backend-core` environment points to the service hostname `http://ai-service:8000` rather than `http://localhost:8000`.
