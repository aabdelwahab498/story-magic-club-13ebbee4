# Backup & Disaster Recovery Plan (backup-recovery-plan.md)

This document maps recovery objectives and rollback procedures for the database and container services.

---

## 1. Database Backup & Restore Plan

### Backup Schedule
* **Daily Backups:** Automated daily snapshots managed by the Supabase database engine.
* **Point-in-Time Recovery (PITR):** Transaction logs are written continuously to support point-in-time recovery.

### Restore Procedure
1. Navigate to the cloud database dashboard.
2. Select the target snapshot date.
3. Initiate restore. Restored tables remain locked during reconstruction.

---

## 2. Version Rollback Procedures

### Frontend
1. If the current version is unstable, update the DNS mapping to target the previous CDN build folder (e.g. roll back from `/releases/v1.0.0` to `/releases/v0.9.0`).
2. Deployment CDN switch times are instantaneous.

### Backend & AI Service
1. Update the docker-compose image tag in the deployment configuration file:
   ```yaml
   image: najmah/backend-core:v0.9.0
   ```
2. Re-trigger container construction:
   ```bash
   docker-compose up -d --no-deps backend-core
   ```
3. Docker starts the old version container and switches traffic, minimizing downtime.
