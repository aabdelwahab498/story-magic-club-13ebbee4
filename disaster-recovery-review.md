# Disaster Recovery & Resiliency Review (disaster-recovery-review.md)

This report documents how the Najmah AI Platform responds to downstream service outages, database connectivity issues, and provider failures.

---

## 1. Downstream Service Failure Modes

### Database / Supabase Outage
- **Symptoms:** Database queries time out, or throw connection reset errors.
- **System Response:** 
  - Incoming client requests requiring DB access fail with a standard `500 Internal Server Error` (managed by `HttpExceptionFilter`).
  - Readiness health check `/health/ready` fails immediately with `database: disconnected` and returns `503 Service Unavailable`, signaling container orchestrators to remove the instance from active load balancers.
- **Recovery:** Once the Supabase connection is restored, the connection pool automatically re-establishes connections with no server restarts required.

### Redis Cache Offline
- **Symptoms:** Redis service cannot be reached.
- **System Response:**
  - Thanks to `lazyConnect: true`, the Backend Core service starts successfully. 
  - Readiness check `/health/ready` reports `redis: disconnected` but the service remains operational for basic non-cached database requests.
- **Recovery:** Connection re-establishment is handled automatically by the `ioredis` client's built-in retry strategy on subsequent requests.

### Python AI Service (FastAPI) Offline
- **Symptoms:** AI Service cannot be resolved, or returns 502/503.
- **System Response:**
  - Story planning requests fail with `500 Internal Server Error` (logging `Python AI Service returned 5xx/unreachable`).
  - Readiness probe `/health/ready` reports `pythonAi: unreachable` and returns `503 Service Unavailable`.
- **Recovery:** Once the Python service comes back online, health checks automatically clear, and requests succeed.

### Google Gemini / Illustration Provider Outage
- **Symptoms:** API requests to Google Generative AI fail (e.g. quota limits, timeouts, service down).
- **System Response:**
  - The story writer regeneration loop retries the generation up to two times.
  - If all retries fail, it throws an `IllustrationService Exception` or `StoryPlanner Exception`, returning a structured validation error to the client.
  - The health check detects that the service is configured but the provider status may degrade.

---

## 2. Fail-Safe Recommendations
- **Orchestrated Auto-Scaling:** Deploy Backend Core and AI Service under an orchestrator (like Kubernetes or ECS) that utilizes the `/health/ready` endpoint. This ensures that unhealthy containers are automatically terminated and replaced.
- **Read-Only Mode:** In future sprints, consider introducing a read-only fallback mode when database instances are degraded, allowing children to read cached stories locally from the PWA offline storage.
