# Operational Troubleshooting Guide — Najmah AI Platform

This guide provides technical resolutions for common operational issues, startup errors, database connectivity failures, and API provider exceptions.

---

## 1. Backend Core Startup Failures

### Symptom: NestJS server fails to start with `EnvValidationError`
```
[EnvConfig] Missing or malformed required environment variables: SUPABASE_URL, GEMINI_API_KEY
```

#### Resolution:
1. Verify `backend-core/.env` exists.
2. Ensure all required variables listed in [environment-variables.md](file:///d:/AI-Projects/Najmah-AI-Platform/docs/customer/environment-variables.md) are set with valid non-empty strings.
3. Restart backend core using `npm run start:dev`.

---

## 2. Database Connection Issues

### Symptom: `ECONNREFUSED` or PostgreSQL Socket Error
```
[Database] Failed to connect to Supabase database socket at xyz.supabase.co:5432
```

#### Resolution:
1. Check internet connectivity and verify Supabase project status.
2. Confirm `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct.
3. Verify firewall outbound ports `443` (HTTPS) and `5432` (Postgres) are open.

---

## 3. Python AI Microservice Errors

### Symptom: `PYTHON_AI_URL` timeout or `502 Bad Gateway` from FastAPI
```
[AIOrchestrator] Failed to reach Python AI service at http://localhost:8000/api/v1/stories/plan
```

#### Resolution:
1. Ensure the Python virtual environment is activated (`.\venv\Scripts\activate`).
2. Verify Uvicorn server is running: `python -m uvicorn app.main:app --port 8000`.
3. Check FastAPI health probe at `http://localhost:8000/health`.

### Symptom: Gemini API Key Quota Exceeded or Invalid Key
```
[GeminiProvider] google.api_core.exceptions.ResourceExhausted: 429 Resource has been exhausted
```

#### Resolution:
1. Verify `GEMINI_API_KEY` in `ai-service/.env` is valid and active.
2. Check Google Cloud Console billing quota limits for Gemini API.

---

## 4. PDF / Export Download Errors

### Symptom: `500 Internal Server Error` during PDF or ZIP export
```
[IllustratedStoryExportService] Failed to export story PDF: Storage bucket 'pdf_exports' does not exist
```

#### Resolution:
1. Log into your Supabase dashboard -> Storage.
2. Verify buckets `pdf_exports`, `audio`, and `illustrations` exist.
3. Ensure storage policies permit `insert` and `select` for service role keys.

---

## 5. Docker Compose Startup Issues

### Symptom: Port conflicts on 3000 or 8000
```
Error starting userland proxy: listen tcp4 0.0.0.0:3000: bind: address already in use
```

#### Resolution:
1. Identify process occupying port 3000: `netstat -ano | findstr 3000` (Windows) or `lsof -i :3000` (Linux).
2. Kill the blocking process or update `PORT` in `backend-core/.env`.
