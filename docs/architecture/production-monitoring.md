# Production Monitoring Plan

To ensure high availability, performance, and cost-efficiency in the Najmah AI Platform, the following monitoring strategies must be implemented for the MVP v1.0 release.

## 1. Backend Monitoring (NestJS)
The NestJS application handles core business logic and AI orchestration.

- **API Health:** Monitor the `GET /health` endpoint uptime and latency via external tools (e.g., Datadog, UptimeRobot, or AWS CloudWatch).
- **API Errors:** Track all 5xx HTTP response codes to identify system outages or unhandled exceptions. Alerting should trigger if error rates spike above 1%.
- **Response Times:** Measure P95 and P99 latency for critical endpoints, particularly Story Library reads and requests.
- **Database Connectivity:** Monitor for query timeouts or connection pool exhaustion.

## 2. AI Pipeline & Gateway Monitoring
AI generation represents the largest latency and cost factor in the application.

- **Generation Duration:** Track the time taken for each stage (`planStory`, `writeStory`, `validateStory`). Set alerts if the total generation time exceeds 30 seconds.
- **Failed Generations:** Monitor the `StoryStatus.FAILED` count. A spike in failures likely indicates an issue with the LLM provider (Gemini API).
- **Validation Rejections:** Track the frequency of AI validation failures (e.g., content flagged for age-inappropriate concepts). High rejection rates require prompt engineering adjustments.
- **Token/Cost Tracking (Preparation):** Log approximate token usage per request within the `StoryMetricsService` to monitor daily LLM costs.

## 3. Frontend Monitoring (React + Vite)
Client-side monitoring ensures the parent and child experiences remain smooth.

- **Client Errors:** Implement error boundaries and integrate a tracking service (e.g., Sentry) to capture unhandled React exceptions.
- **Failed API Requests:** Monitor for high frequencies of 4xx and 5xx errors originating from the client, indicating authentication issues or backend downtime.
- **Performance Web Vitals:** Track LCP (Largest Contentful Paint) and CLS (Cumulative Layout Shift), especially on the Story Reader screens where illustrations are loaded.

## 4. Alerting Matrix
| Component | Metric | Threshold | Priority |
| :--- | :--- | :--- | :--- |
| **API Health** | `/health` Uptime | < 99.9% | P1 (Critical) |
| **Database** | Query Timeouts | > 5% of queries | P1 (Critical) |
| **AI Generation** | Pipeline Failures | > 10% in 1 hr | P2 (High) |
| **Frontend** | Unhandled Exceptions | > 50 in 1 hr | P2 (High) |
| **AI Cost** | Token Usage | > Daily Budget | P3 (Warning) |
