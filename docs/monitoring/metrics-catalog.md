# Metrics Catalog (metrics-catalog.md)

This catalog maps Prometheus metrics exposed under `/metrics` in NestJS and FastAPI.

---

## 1. Gateway Application Metrics
* `http_requests_total` (counter): Tracks the total count of incoming HTTP requests, categorized by route, method, and response status.
* `http_request_duration_seconds` (histogram): Measures HTTP request processing latencies.
* `database_query_duration_seconds` (histogram): Traces Postgres SQL query durations.

---

## 2. Generative AI Metrics
* `ai_provider_latency_seconds` (histogram): Traces external Google Gemini REST api execution latencies.
* `story_generation_failures_total` (counter): Counts failed story generation attempts.
* `story_generation_duration_seconds` (histogram): Measures complete story creation latencies.

---

## 3. Media Processing Metrics
* `file_processing_duration_seconds` (histogram): Traces PDF compilation and stitching durations.
* `tts_audio_generation_duration_seconds` (histogram): Traces synthetic voice narration processing times.
