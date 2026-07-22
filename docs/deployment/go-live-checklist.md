# Go-Live Checklist (go-live-checklist.md)

This checklist tracks infrastructure configuration, deployment validation, and security setup steps before launch.

---

## 1. Infrastructure Checks
- [ ] **Domain configured:** Custom DNS mapping resolved to cloud load balancer.
- [ ] **SSL enabled:** HTTPS traffic certificates active.
- [ ] **Postgres Backups:** Automated daily snapshot routines configured in Supabase.
- [ ] **Monitoring scrapers:** Prometheus and Grafana alerts active.

---

## 2. Service Deployment Status
- [ ] **Frontend deployed:** Compiled HTML/JS static directory pushed to CDN.
- [ ] **Backend deployed:** NestJS API gateway running inside container.
- [ ] **AI Service deployed:** Python FastAPI microservice running inside container.
- [ ] **Database migrations:** Pushed and applied with RLS policies active.

---

## 3. Security Settings
- [ ] **Secrets verification:** All required env secrets set.
- [ ] **SameSite secure cookies:** Token cookies marked `Secure`, `HttpOnly`, `SameSite=Lax`.
- [ ] **CORS configuration:** Domain listed in `CORS_ALLOWED_ORIGINS`.
