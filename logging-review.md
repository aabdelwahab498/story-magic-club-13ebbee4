# Logging Security & Audit Review (logging-review.md)

This review evaluates the logging architecture of the NestJS and FastAPI services to ensure operational clarity and prevent sensitive data leakage.

---

## 1. Secrets Leakage Verification
We audited all occurrences of `logger.log`, `logger.warn`, `logger.error`, and stdout outputs:
- **API Keys / Service Keys:** **PASS**. Neither the Google API keys, Gemini tokens, nor the Supabase Service Role credentials are logged.
- **User Passwords / Cookies:** **PASS**. Authentication routes and middleware do not print user passwords, tokens, or JWT cookie values to standard output.
- **Personally Identifiable Information (PII):** **PASS**. Dynamic logs (e.g. story generation pipelines, user profiles) output only UUIDs and event types, avoiding logging names, emails, or child details.

---

## 2. Structured & Contextual Logging
* **Backend Core:** Uses NestJS's built-in `ConsoleLogger` with context scopes (e.g. `[StoryWriter]`, `[IllustrationService]`). In production, logs should be piped to json format or handled by a standard container logging driver (e.g., Fluentd, CloudWatch).
* **AI Service:** Uses Uvicorn’s loggers mapping startup, interface bindings, and request routing to stdout.
* **Provider Failures:** In NestJS and FastAPI, external provider timeouts or failures (e.g., Gemini API, Edge TTS, Supabase connection failures) log descriptive error messages along with trace IDs without printing API key headers.

---

## 3. Startup & Teardown Integrity
- **Startup Logs:** Standard boot steps (config validation, controller binding, port listening) are clearly printed.
- **Teardown Logs:** NestJS graceful shutdown logs connection releases. Python lifespan logs cleanup handlers correctly.

---

## 4. Recommendations
- **JSON Formatting:** In production environments, configure NestJS and FastAPI logging pipelines to output in single-line JSON format. This allows seamless ingestion by log aggregation engines (Datadog, AWS CloudWatch, ELK).
