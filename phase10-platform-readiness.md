# Enterprise Platform Readiness (phase10-platform-readiness.md)

This document describes configuration management systems, startup lifecycles, and dependency checks implemented to verify enterprise platform readiness for the Najmah AI Platform.

---

## 1. Startup & Diagnostics Lifecycle

The server boots in a multi-stage validation sequence to prevent running with invalid configs or detached database connections.

```
[Server Process Launch]
          │
          ▼
[Zod Env Schema Parsing (fail-fast)]
          │
          ▼
[NestJS IOC Container Bootstrap]
          │
          ▼
[runStartupDiagnostics Check]
          ├── Database Connectivity (Required, fail-fast)
          ├── Python AI Endpoint Health (Optional, warning)
          └── Storage Buckets Access (Required, fail-fast)
          │
          ▼
[Port Bind & Listen]
```

---

## 2. Environment Profiles

We enforce unified logging levels and security setups per environment profile:

| Parameter | Development | Testing | Staging / Production |
| :--- | :--- | :--- | :--- |
| **Log Format** | Console / Human-readable | Silent | Structured JSON (Pino/Pino-compatible) |
| **CORS policy** | `http://localhost:*` | Mocks only | Strict Allowed Origins (Configured in env) |
| **Security Headers** | Basic | Disabled | Strict HTTP headers (Helmet) |
| **Metrics `/metrics`** | Active | Active | Active |

---

## 3. Dependency Validation & Graceful Failures

* **Supabase / Postgres Connection:** Verified at bootstrap. If database queries throw a connectivity error, the application exits immediately with code 1.
* **Storage Access:** Storage bucket existence is validated at startup. Failure to query or list buckets results in a fail-fast exit.
* **FastAPI AI Service:** Marked as a soft/optional dependency. If FastAPI is down or returns non-200 statuses, warnings are logged but the application continues to run (allowing mock failbacks to handle generation if `USE_MOCK_LLM=true`).

---

## 4. Resilience Assessment Recommendations

To prepare for high-concurrency scaling, we recommend the following enhancements:
1. **Request Timeouts:** Standardize HTTP timeouts (already set via `REQUEST_TIMEOUT` defaulting to 30s) across all outbound service clients.
2. **Circuit Breaker Pattern:** Implement circuit breakers (e.g. Opossum) on FastAPI and Gemini LLM calls to prevent system degradation when APIs are throttled.
3. **Graceful Shutdown Hooks:** Handled natively in NestJS by waiting for active connection close signals.
