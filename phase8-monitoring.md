# Advanced Observability Monitoring (phase8-monitoring.md)

This document describes the Prometheus and Grafana production monitoring stack configurations for the Najmah AI Platform.

---

## 1. System Visibility Architecture

We have established end-to-end trace correlation and structured JSON logging. Prometheus now scrapes fine-grained metrics from target endpoints, which are automatically visualized by Grafana.

```
                    Grafana
                       |
                  Prometheus
                       |
        --------------------------------
        |                              |
    NestJS Metrics              FastAPI Metrics
        |                              |
        --------------------------------
                       |
              Structured Logs
                       |
              Request/Trace IDs
```

---

## 2. Prometheus Metrics Specification

### Backend Core
Exposed at `GET /api/v2/metrics`:
- **`http_requests_total`** (counter): Total request count.
- **`http_errors_total`** (counter): Requests returning HTTP >= 400.
- **`story_generation_total`** (counter): Story plans generated.
- **`illustration_generation_total`** (counter): Scene illustrations requested.
- **`audio_generation_total`** (counter): Text-to-speech narrates processed.
- **`pdf_export_total`** (counter): PDF generation requests.
- **`active_requests`** (gauge): Currently executing concurrent requests.
- **`memory_usage`** (gauge): Node.js heap memory usage in bytes.
- **`cpu_usage`** (gauge): CPU User + System execution time in seconds.
- **`http_request_duration_seconds`** (histogram): Request latency distribution.
- **`ai_generation_duration_seconds`** (histogram): LLM generation time distribution.

### Python AI Service
Exposed at `GET /metrics`:
- **`ai_requests_total`** (counter): Total requests received.
- **`ai_provider_failures_total`** (counter): Gemini model errors.
- **`ai_generation_success_total`** (counter): Successful planning operations.
- **`ai_request_duration_seconds`** (histogram): AI planner duration distribution.

---

## 3. Prometheus Rules & Alerts

Alerts are defined in [alert.rules.yml](file:///d:/AI-Projects/Najmah-AI-Platform/prometheus/alert.rules.yml) and trigger on anomalous state criteria:
1. **HighErrorRate:** Triggers if HTTP error rate exceeds 5% of traffic over a 5-minute window (`rate(http_errors_total[5m]) > 0.05`).
2. **HighLatency:** Triggers if the 95th percentile of response latencies exceeds 2 seconds (`histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 2`).
3. **AiProviderFailure:** Triggers if failures calling Gemini API increase abnormally (`rate(ai_provider_failures_total[5m]) > 0.01`).
4. **ServiceDown:** Triggers if Prometheus loses connectivity to NestJS or FastAPI targets (`up == 0`).

---

## 4. Grafana Dashboards

The following dashboards are auto-provisioned inside the `Najmah Studio` folder:
1. **Platform Overview ([platform_overview.json](file:///d:/AI-Projects/Najmah-AI-Platform/grafana/dashboards/platform_overview.json)):** Summary statistics of total throughput, failure rate percentage, average request duration, active connections, and container health.
2. **AI Platform Insights ([ai_platform.json](file:///d:/AI-Projects/Najmah-AI-Platform/grafana/dashboards/ai_platform.json)):** Activity rates for stories, illustrations, audio narrations, and PDF exports, alongside Gemini model latency averages.
3. **API Performance ([api_performance.json](file:///d:/AI-Projects/Najmah-AI-Platform/grafana/dashboards/api_performance.json)):** Percentile latency lines (P50, P95, P99) and status code distributions.
