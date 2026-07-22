# Database Release Checklist (database-release-checklist.md)

This checklist verifies schema readiness, security policies, and performance optimizations for the database layer prior to customer release.

---

## 1. Schema & Migration Integrity
- [x] **No Pending Migrations:** Checked. All PostgreSQL scripts are fully pushed and applied.
- [x] **Strict Semantic Constraint Verification:** No destructive table schema alterations or deletions of applied migrations exist.
- [x] **Foreign Key Constraints:** Foreign keys are explicitly defined and indexed to avoid locking or deadlocks during heavy SQL writes.

---

## 2. Row-Level Security (RLS) & Access Compliance
- [x] **RLS Enabled:** Checked on all tables.
- [x] **has_role Guard Verification:** Access is verified using database-level `has_role` checks to restrict read/write access to valid tokens.
- [x] **Admin Key Isolation:** No client bundles can read or capture the Supabase `service_role` key.

---

## 3. Storage & Backups
- [x] **Storage Bucket RLS:** Check and list permissions verified on `illustrations`, `audio`, `avatars`, and `covers` buckets.
- [x] **Backup Strategy:** Daily automated snapshots are configured in the cloud database dashboard.
