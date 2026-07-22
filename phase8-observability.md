# Observability Foundation (phase8-observability.md)

This document establishes the structured logging, tracing, and metric collection architecture for the Najmah AI Platform.

---

## 1. Structured Logging Architecture

Both Backend Core and Python AI Services are instrumented to emit unified JSON-structured logs in production. This format prevents sensitive information leakage and simplifies ingestion into log aggregators (e.g., Elasticsearch, AWS CloudWatch, Datadog).

### Standard JSON log structure:
```json
{
  "timestamp": "2026-07-21T01:58:00Z",
  "level": "INFO",
  "context": "StoryPlanner",
  "message": "Delegating Story Planning to Python AI Service",
  "request_id": "8f8446b9-b88a-40a2-aa90-b9ad8281a6d4",
  "trace_id": "d04a6cb1-4475-4318-8ce9-9ad3837943c2",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "service": "najmah-backend-core"
}
```

- **Sensitive Fields Redacted:** Tokens, cookies, passwords, and private API keys are completely stripped and never printed to standard output.
- **Stack Trace Suppression:** Exception stack traces are automatically hidden in production environments, while remaining visible in local development environments.

---

## 2. Request Lifecycle & Tracing

### Request ID Middleware
- Every HTTP request passing through the API gateway is checked for an `X-Request-ID` header.
- If missing, a cryptographically secure UUID is generated.
- The `X-Request-ID` is:
  1. Attached to the request lifecycle via Node.js `AsyncLocalStorage`.
  2. Returned to the client in the `X-Request-ID` response header.
  3. Included in all log statements.

### Trace ID & Propagation
- The `X-Trace-ID` is propagated across service boundaries.
- When NestJS delegates tasks to the FastAPI Python service, it forwards the active `X-Trace-ID` in the request headers.
- FastAPI captures this header and maps it to its thread-safe `contextvars` context, linking all logs emitted by FastAPI to the original client request.

---

## 3. Metrics Architecture (`/metrics`)

### Gateway Metrics (NestJS)
Exposed at `GET /metrics` in a Prometheus-compatible text format:
- **`najmah_total_requests`** (counter): Total requests processed.
- **`najmah_active_requests`** (gauge): Currently active/concurrent requests.
- **`najmah_failed_requests`** (counter): Total requests that threw exceptions or returned status codes >= 400.
- **`najmah_average_latency_ms`** (gauge): Average latency across all requests.
- **`najmah_story_generation_requests`** (counter): Total requests routed to `/story` or `/stories`.
- **`najmah_illustration_requests`** (counter): Total requests routed to `/illustration`.
- **`najmah_audio_requests`** (counter): Total requests routed to `/audio` or `/tts`.
- **`najmah_pdf_requests`** (counter): Total requests routed to `/pdf`.

### Python AI Metrics (FastAPI)
Exposed at `GET /metrics`:
- **`najmah_ai_requests_total`**: Requests received by the python service.
- **`najmah_ai_latency_avg_ms`**: Average response latency.
- **`najmah_ai_generations_total`**: Total Gemini text/plan generation attempts.
- **`najmah_ai_provider_failures_total`**: Failed calls to Gemini model APIs.

---

## 4. Future Integrations
- **Prometheus Scrape Configuration:** Point a Prometheus server instance to retrieve the `/metrics` endpoints.
- **Grafana Dashboard:** Create a dashboard tracking latency averages, active/failed requests, and AI service provider health.
