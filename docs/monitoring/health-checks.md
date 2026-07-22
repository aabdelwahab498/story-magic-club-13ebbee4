# Health Check Specifications (health-checks.md)

This document maps liveness and readiness diagnostic endpoints across all services.

---

## 1. Backend Gateway Health
* **Liveness Endpoint:** `GET /api/v2/health/live`
  - Returns: `{ "status": "ok", "service": "nestjs", "version": "1.0.0" }`.
  - Action: Verifies application container is active.
* **Readiness Endpoint:** `GET /api/v2/health/ready`
  - Returns: Detailed database check payload.
  - Action: Verifies Postgres socket connection and query availability.

---

## 2. Python AI Service Health
* **Endpoint:** `GET /health`
  - Returns: `{ "status": "ok", "service": "ai-service" }`.
  - Action: Verifies FastAPI event loop is responsive.

---

## 3. Database Check
* **Check Routine:** Executed during gateway bootstrap diagnostics:
  - Query: `client.from('profiles').select('id').limit(1)`.
  - Action: If queries time out or throw, the bootstrap fails-fast, stopping the gateway.
