# Environment Variables Configuration (environment-variables.md)

This document maps all required and optional configurations for the Najmah AI Platform components.

---

## 1. Backend Core Configs

| Key Name | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Yes | `3000` | HTTP port for NestJS |
| `NODE_ENV` | Yes | `development` | Target profile (`development` / `production`) |
| `SUPABASE_URL` | Yes | - | Supabase API endpoint url |
| `SUPABASE_ANON_KEY` | Yes | - | Public anon API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (Backend) | - | Private server admin key (do NOT expose to frontend) |
| `CORS_ALLOWED_ORIGINS` | Yes | - | Comma-separated list of allowed origins |
| `PYTHON_AI_URL` | Yes | `http://localhost:8000` | Python AI service endpoint |
| `MASTER_ENCRYPTION_KEY` | No (Recommended)| - | 64-character hex key for AES-256 data security |

---

## 2. Frontend configs

| Key Name | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_URL` | Yes | `http://localhost:3000` | Target URL of the backend REST gateway |

---

## 3. Python AI Service Configs

| Key Name | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | Yes | - | Google Gemini AI integration secret token |
| `GEMINI_MODEL` | No | `gemini-1.5-flash` | LLM model model to query |
