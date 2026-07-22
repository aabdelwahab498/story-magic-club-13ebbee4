# Admin Guide (admin-guide.md)

This operations guide explains how administrators can monitor platform health, audit user activity, and manage configurations.

---

## 1. Monitoring & Performance Dashboards
* **Prometheus Metrics:** The NestJS and FastAPI services expose active metrics under `/metrics`. Monitor API response times, database query latencies, and AI provider speeds.
* **Grafana Dashboards:** Visualize request throughput, error counts, and credit consumption rates.
* **Alerting Policies:** Configure alerts to notify developers if liveness checks fail or if database connections approach limits.

---

## 2. Managing Users & Quotas
* **Admin Dashboard:** Access database transaction tables via the Admin interface.
* **Auditing Logs:** All system actions that modify credits or user limits are logged to `ai_audit_logs`. Search logs by user ID or transaction ID.

---

## 3. Configuration Management
* **Secrets Rotation:** Annually rotate the `MASTER_ENCRYPTION_KEY` using secure environment injection.
* **Environment Profiles:** Ensure `NODE_ENV=production` is set in production to enforce structured JSON logging and strict CORS allowlists.
