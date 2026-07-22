#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Najmah AI Platform — Database Restore Script
# Usage: ./scripts/restore-database.sh <path_to_backup_file.sql.gz>
# ─────────────────────────────────────────────────────────────────────────────

set -e

BACKUP_FILE="$1"

if [ -z "${BACKUP_FILE}" ] || [ ! -f "${BACKUP_FILE}" ]; then
  echo "[ERROR] Backup file path required and must exist."
  echo "Usage: ./scripts/restore-database.sh ./backups/najmah_db_YYYYMMDD_HHMMSS.sql.gz"
  exit 1
fi

if [ -z "${SUPABASE_DB_URL}" ] && [ -z "${PGHOST}" ]; then
  echo "[ERROR] Database connection parameters missing. Set SUPABASE_DB_URL or PGHOST/PGUSER."
  exit 1
fi

echo "[WARNING] Restoring database will overwrite existing schema and data."
read -p "Are you sure you want to proceed? (y/N): " CONFIRM
if [[ "${CONFIRM}" != "y" && "${CONFIRM}" != "Y" ]]; then
  echo "[INFO] Restore operation cancelled."
  exit 0
fi

echo "[INFO] Restoring database from ${BACKUP_FILE}..."

if [ -n "${SUPABASE_DB_URL}" ]; then
  gunzip -c "${BACKUP_FILE}" | psql "${SUPABASE_DB_URL}"
else
  gunzip -c "${BACKUP_FILE}" | psql -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE:-postgres}"
fi

echo "[SUCCESS] Database restoration complete!"
