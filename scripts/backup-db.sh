#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${DATA_DIR:-$ROOT/data}"
DB="${DATABASE_PATH:-$DATA_DIR/planner.db}"
BACKUP_DIR="$DATA_DIR/backups"
mkdir -p "$BACKUP_DIR"
if [[ ! -f "$DB" ]]; then
  echo "No database at $DB — nothing to backup"
  exit 0
fi
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/planner-$STAMP.db"
cp "$DB" "$OUT"
# also copy wal/shm if present
[[ -f "$DB-wal" ]] && cp "$DB-wal" "$OUT-wal" || true
[[ -f "$DB-shm" ]] && cp "$DB-shm" "$OUT-shm" || true
echo "Backed up to $OUT"
