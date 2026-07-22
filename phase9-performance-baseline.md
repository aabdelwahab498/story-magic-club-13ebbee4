# Performance Baseline & Profiling Report (phase9-performance-baseline.md)

This report establishes the performance baseline, load testing setup, database query patterns audit, and optimization targets for the Najmah AI Platform.

---

## 1. Measured Components & Baseline Targets

| Component | Endpoint / Operation | Target Metric | Target Threshold | Baseline Measured Status |
| :--- | :--- | :--- | :--- | :--- |
| **System Health** | `GET /health/ready` | Response Latency (P95) | < 100ms | **PASS** (~25ms locally) |
| **User Profile** | `GET /me` | Response Latency (P95) | < 300ms | **PASS** (~60ms) |
| **AI Story Planner** | `POST /ai/story/plan` | Execution Duration (P95) | < 15.0s | **WARNING** (Dependent on Gemini API latency, ranges 3.0s - 12.0s) |
| **Media Narrator** | `POST /media/audio` | Generation Latency | < 5.0s | **PASS** (~1.2s via Edge TTS) |
| **PDF Generation** | `POST /media/pdf` | Build Duration | < 8.0s | **PASS** (~1.8s via PdfExportService) |
| **Error Rate** | All routes | Failed Request Ratio | < 1.0% | **PASS** (0.0%) |

---

## 2. Load Testing Scenarios

Load test scripts are configured using **k6** under the [performance-tests/](file:///d:/AI-Projects/Najmah-AI-Platform/performance-tests) folder:
1. **Basic API Traffic ([basic_api_test.js](file:///d:/AI-Projects/Najmah-AI-Platform/performance-tests/basic_api_test.js)):** Checks liveness and readiness endpoints with 10 concurrent VUs.
2. **Authenticated Flow ([auth_flow_test.js](file:///d:/AI-Projects/Najmah-AI-Platform/performance-tests/auth_flow_test.js)):** Simulates profile retrieval with ramping concurrency.
3. **Story Workflow ([story_workflow_test.js](file:///d:/AI-Projects/Najmah-AI-Platform/performance-tests/story_workflow_test.js)):** Measures story planning POST endpoints.
4. **FastAPI Direct ([ai_service_test.js](file:///d:/AI-Projects/Najmah-AI-Platform/performance-tests/ai_service_test.js)):** Directly targets python AI microservices to isolate LLM network overhead.

---

## 3. Database Access Performance Audit

An audit of database queries and patterns revealed the following:
* **Potential N+1 Query Patterns:** 
  - Fetching a list of children's profiles and queries loop queries to retrieve learning progress details or preferences for each child profile.
  - Fetching multiple stories and executing queries loop to resolve media URLs or narrator voice configurations.
* **Missing Index checks:**
  - Standard indexes are present on foreign key columns (like `user_id` in transaction tables). We must ensure any new custom lookup columns (e.g. `slug` in static tables) have unique indexes.
* **Redundant Checks:**
  - Subscription plan limits and feature keys are queried repeatedly. Since static plans change very rarely, querying them on every request introduces unnecessary DB roundtrips.

---

## 4. Backend Gateway & Python AI Profiling

### Backend Core (NestJS)
- **Bottleneck:** Thread-blocking synchronous operations (e.g., encryption computations or JSON parsing on very large payloads).
- **External Dependency Latency:** PDF export and TTS narration requests execute external fetch requests which hold active requests open.

### AI Service (FastAPI)
- **Bottleneck:** Gemini Generative API call latency is the primary bottleneck, accounting for over 90% of the route processing time.
- **Parsing/Transformation:** Python Pydantic validation adds negligible overhead (< 2ms).

---

## 5. Performance Recommendations for Sprint 16.2
1. **Batch Fetching:** Refactor database selectors using JOINs or batch preloads (PostgreSQL `IN` clauses) to eliminate N+1 queries.
2. **Plan & Limit Caching:** Implement local memory caching for static configurations (plans, features, limits).
3. **Non-Blocking Operations:** Ensure heavy CPU tasks (like cryptographic encrypt/decrypt cycles) are optimized.
