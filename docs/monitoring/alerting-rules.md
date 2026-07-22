# Alerting Rules Configuration (alerting-rules.md)

This document specifies production alert rules to monitor platform health.

---

## 1. System Alert Rules

### Rule 1: Service Down
* **Condition:** `up == 0`
* **Duration:** 1 minute
* **Severity:** Critical
* **Description:** Triggers if either the NestJS Gateway or Python AI Service stops responding.

### Rule 2: High Error Rate
* **Condition:** `rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05`
* **Duration:** 3 minutes
* **Severity:** Critical
* **Description:** Alerts if 5xx errors exceed 5% of incoming traffic over a 5-minute window.

---

## 2. API Latency Alerts

### Rule 3: Slow API Response
* **Condition:** `histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)) > 2.0`
* **Duration:** 5 minutes
* **Severity:** Warning
* **Description:** Alerts if 95% of standard REST requests take longer than 2 seconds.

### Rule 4: Slow DB Queries
* **Condition:** `histogram_quantile(0.90, sum(rate(database_query_duration_seconds_bucket[5m])) by (le)) > 0.2`
* **Duration:** 5 minutes
* **Severity:** Warning
* **Description:** Alerts if 90% of Postgres database queries take longer than 200ms.
