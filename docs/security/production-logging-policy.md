# Production Logging Policy (production-logging-policy.md)

This logging policy defines privacy rules, trace attributes, and token scrubbing guidelines for production log aggregators.

---

## 1. Trace Metadata Requirements
To enable distributed tracing, every log entry written to stdout must be structured in JSON format and contain:
* `timestamp`: ISO-8601 formatted time string.
* `request_id` / `trace_id`: Globally unique IDs propagated across NestJS and FastAPI services.
* `user_id`: UUID of the authenticated user (if present).
* `route` / `method` / `status_code` / `latency_ms`.

---

## 2. Forbidden Sensitive Data (Scrub List)
To prevent security leaks, logging modules must verify that the following elements are stripped from log outputs:
* Passwords or plain-text login credentials.
* JWT signing secrets, database passwords, or Google API keys.
* Client token cookies (`najmah_token`).
* Child PII details (e.g. child name, specific date of birth).
