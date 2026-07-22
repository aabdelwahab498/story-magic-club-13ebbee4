# Monitoring Architecture Blueprint (monitoring-architecture.md)

This blueprint documents telemetry flows and metric pipelines across the Najmah platform.

---

## 1. Metrics Pipeline Flow

```
 [Backend NestJS Core]          [FastAPI AI Service]
        │                              │
        ├── (HTTP /metrics)            ├── (HTTP /metrics)
        ▼                              ▼
 [Prometheus Telemetry Scraper Container]
        │
        ▼ (TSDB Storage)
 [Grafana Visual Dashboard]
        │
        ▼ (Alert Rules evaluation)
 [Notification Channels] (Slack / Email)
```

---

## 2. Telemetry Components
* **Prometheus Server:** Scrapes REST endpoints (`/metrics`) per service every 15s to record CPU load, active connections, and latency metrics.
* **Grafana Server:** Displays real-time dashboards mapping API latency percentiles and error metrics.
* **Structured Logs:** Containers write JSON structured logs to stdout, captured by Fluentd or Logstash for storage.
