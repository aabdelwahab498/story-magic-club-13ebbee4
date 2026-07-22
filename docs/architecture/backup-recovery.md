# Backup & Recovery Plan

This document outlines the database backup strategy and recovery procedures for the Najmah AI Platform production environment. Since the core data resides within Supabase PostgreSQL, this strategy relies heavily on Supabase's managed infrastructure.

## 1. Important Data Assets
The following critical data must be protected and restorable:
- **Users (Authentication):** User identities and encrypted passwords managed via Supabase Auth.
- **Tenant Profiles:** Parent/Admin profiles.
- **Child Profiles:** Including age, language preferences, and SEL goals.
- **Story Requests:** Audit trails of all AI generation attempts.
- **Generated Content:** The final `stories` table data (JSON pages) and associated analytics.

## 2. Backup Strategy

### 2.1. Automated Logical Backups (Daily)
- **Schedule:** Automated daily pg_dump logical backups managed by Supabase.
- **Retention:** Varies by Supabase plan (typically 7 to 30 days).
- **Scope:** Includes schema definitions, user data, and all relational data.

### 2.2. Point-In-Time Recovery (PITR)
- **Enabled:** Strongly recommended to enable PITR on the Supabase Pro/Enterprise tier for the production project.
- **Granularity:** Allows restoring the database to any exact minute within the retention window (e.g., recovering from accidental mass deletions or buggy migrations).

## 3. Recovery Procedure

### 3.1. Full Environment Restoration
In the event of catastrophic data loss or region failure:
1. **Provision New Instance:** Spin up a new Supabase project (if the primary is unrecoverable).
2. **Apply Migrations:** Run the existing migration suite (`supabase db push`) to establish the schema.
3. **Restore Data:** Import the latest daily logical backup via `psql` or the Supabase dashboard.
4. **Update Configuration:** Rotate and update backend/frontend environment variables to point to the new Supabase URL and Keys.

### 3.2. Partial Data Recovery (PITR)
If a specific table or set of records was corrupted:
1. Initiate a PITR restoration via the Supabase dashboard to a parallel project (do not overwrite production directly).
2. Export the required clean data from the restored parallel project.
3. Import the clean data into the live production database.
4. Verify data integrity.
