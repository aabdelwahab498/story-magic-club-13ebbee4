# Najmah v1.0 Database Production Audit (database-production-audit.md)

This report evaluates database integrity, schema migrations, and Row-Level Security (RLS) configurations before the v1.0 release.

---

## 1. Schema & Migration Review
* **Migration Strategy:** The platform uses Supabase CLI/PostgreSQL migrations. Schema updates are applied sequentially; deletion of applied migrations is strictly forbidden.
* **Foreign Key Constraints:** Indexed to prevent table locks and slow joins.
* **JSONB Columns:** Multilingual text values are stored inside JSONB structures (e.g. `{ "en": "...", "ar": "..." }`) to ensure localized query scalability.

---

## 2. Row-Level Security (RLS) Status
All database tables have RLS enabled. User and editor actions are validated using the `has_role` RPC:

| Database Table | RLS Policy | Access Rules |
| :--- | :--- | :--- |
| `profiles` | Active | Select/Update limited to owner user_id |
| `ai_story_history` | Active | Select/Insert limited to owner user_id |
| `sel_outcome` | Active | Read-only for users, Admin write |
| `ai_audit_logs` | Active | Insert only for service roles, admin read |

---

## 3. Data Integrity & Backups
* **Audit Trail:** Operations modifying credits or plan allocations are logged to `ai_audit_logs` and `payment_logs` capturing timestamps and UUIDs.
* **Backup Schedule:** Configured through Supabase cloud console providing daily automated transaction log snapshots.
