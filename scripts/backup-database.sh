#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Najmah AI Platform — Automated Database Backup Script
# Usage: ./scripts/backup-database.sh [backup_directory]
# ─────────────────────────────────────────────────────────────────────────────

set -e

BACKUP_DIR="${1:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/najmah_db_${TIMESTAMP}.sql.gz"

echo "[INFO] Starting Najmah Database Backup..."
mkdir -p "${BACKUP_DIR}"

if [ -z "${SUPABASE_DB_URL}" ] && [ -z "${PGHOST}" ]; then
  echo "[ERROR] Database connection parameters missing. Set SUPABASE_DB_URL or PGHOST/PGUSER."
  exit 1
fi

if [ -n "${SUPABASE_DB_URL}" ]; then
  pg_dump "${SUPABASE_DB_URL}" | gzip > "${BACKUP_FILE}"
else
  pg_dump -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE:-postgres}" | gzip > "${BACKUP_FILE}"
fi

echo "[SUCCESS] Database backup created successfully: ${BACKUP_FILE}"

# Keep only the last 14 backup files
find "${BACKUP_DIR}" -type f -name "najmah_db_*.sql.gz" -mtime +14 -exec rm -f {} \;
echo "[INFO] Retention policy applied (cleared backups older than 14 days)."
