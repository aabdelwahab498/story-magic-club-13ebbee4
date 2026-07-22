# Najmah Environment Baseline (v1.0.0)

This document establishes the required environment variable footprints across the three layers of the application stack. **DO NOT commit actual secrets here.** This baseline serves as a reference for configuring deployment environments (Vercel, AWS, etc.).

## 1. Frontend Environment (`.env`)
The React application explicitly requires public keys for client-side API routing.

```env
# API Gateway Routing
VITE_API_URL=

# Supabase Anonymous Keys (Public non-sensitive endpoints only)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## 2. Backend Environment (`backend-core/.env`)
The NestJS core requires full administrative access to Supabase and cryptographic secrets to manage session cookies safely.

```env
# Application Context
NODE_ENV=
PORT=
CORS_ORIGIN=

# Database & Identity Provider (Supabase)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Security Config
SESSION_SECRET=

# AI Microservice Routing
FASTAPI_SERVICE_URL=
```

## 3. AI Gateway Environment (`ai-service/.env`)
The FastAPI layer requires the sensitive LLM vendor credentials and explicit rate-limiting variables if applicable.

```env
# Application Context
ENVIRONMENT=

# Model Vendor Credentials
OPENAI_API_KEY=
GEMINI_API_KEY=

# Internal Validation 
NAJMAH_INTERNAL_API_KEY=
```
