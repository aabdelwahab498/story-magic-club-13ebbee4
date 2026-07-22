# Customer Environment Variables Reference — Najmah AI Platform

This document details all environment variables used across the **Najmah AI Platform**.

---

## 1. Backend Core (`backend-core/.env`)

| Variable Name | Description | Type | Status | Example Value |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | Listening HTTP port for NestJS gateway | Number | Optional | `3000` |
| `NODE_ENV` | Environment mode (`development`, `production`, `test`) | String | Required | `production` |
| `SUPABASE_URL` | Endpoint URL of the Supabase PostgreSQL platform | String (URL) | Required | `https://xyz.supabase.co` |
| `SUPABASE_ANON_KEY` | Public client API key for Supabase | String | Required | `eyJhbG...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Private backend admin key (NEVER expose to frontend) | String | Required | `eyJhbG...` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed origins | String | Required | `https://najmah.example.com` |
| `PYTHON_AI_URL` | Endpoint URL of the Python FastAPI microservice | String (URL) | Required | `http://localhost:8000` |
| `USE_MOCK_LLM` | Toggle mock LLM generation mode (`true`/`false`) | Boolean | Optional | `false` |
| `GEMINI_API_KEY` | Google Gemini API Key for direct fallback calls | String | Required | `AIzaSy...` |
| `GEMINI_MODEL` | Google Gemini LLM model identifier | String | Optional | `gemini-1.5-flash` |
| `ILLUSTRATION_PROVIDER` | Illustration service provider (`google`, `mock`) | String | Optional | `google` |
| `AUDIO_PROVIDER` | Narration voice engine provider (`edge`, `mock`) | String | Optional | `edge` |
| `REQUEST_TIMEOUT` | Global HTTP timeout in milliseconds | Number | Optional | `30000` |
| `STORAGE_BUCKETS` | Comma-separated Supabase storage buckets | String | Optional | `pdf_exports,audio,illustrations` |

---

## 2. Python AI Microservice (`ai-service/.env`)

| Variable Name | Description | Type | Status | Example Value |
| :--- | :--- | :--- | :--- | :--- |
| `PORT` | Listening HTTP port for FastAPI service | Number | Optional | `8000` |
| `HOST` | Listening interface binding | String | Optional | `0.0.0.0` |
| `GEMINI_API_KEY` | Primary API Key for Google Gemini LLM SDK | String | Required | `AIzaSy...` |

---

## 3. Frontend Client (`.env` / `.env.production`)

| Variable Name | Description | Type | Status | Example Value |
| :--- | :--- | :--- | :--- | :--- |
| `VITE_API_URL` | Base REST URL pointing to NestJS Gateway | String (URL) | Required | `https://api.najmah.example.com` |
| `VITE_SUPABASE_URL` | Public Supabase URL | String (URL) | Optional | `https://xyz.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public Supabase key | String | Optional | `eyJhbG...` |
