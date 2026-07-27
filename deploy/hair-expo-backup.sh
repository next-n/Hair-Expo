#!/usr/bin/env bash
set -Eeuo pipefail

# Production-only SQLite backup and restore rehearsal helper.
# This utility never overwrites the live database.

umask 077

PROJECT_DIR="${HAIR_EXPO_PROJECT_DIR:-/opt/hair-expo}"
COMPOSE_FILE="$PROJECT_DIR/deploy/docker-compose.production.yml"
COMPOSE_ENV_FILE="${HAIR_EXPO_COMPOSE_ENV_FILE:-/etc/hair-expo/frontend.env}"
DATA_DIR="${HAIR_EXPO_DATA_DIR:-/var/lib/hair-expo}"
BACKUP_DIR="${HAIR_EXPO_BACKUP_DIR:-/var/backups/hair-expo}"
DB_FILE="$DATA_DIR/hair-expo.sqlite"
RETENTION="${HAIR_EXPO_BACKUP_RETENTION:-288}"
LOCK_FILE="/var/lock/hair-expo-backup.lock"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage:
  hair-expo-backup.sh backup
  hair-expo-backup.sh verify [backup-file]
  hair-expo-backup.sh restore-verify [backup-file]
  hair-expo-backup.sh status

backup         Create a consistent SQLite backup, checksum it, verify it,
               and prune backups older than the configured retention count.
verify         Verify checksum, SQLite integrity, foreign keys, and schema.
restore-verify Run the same checks against a temporary restored copy.
status         Show the live database and available backup files.
EOF
}

require_root() {
  [[ "$(id -u)" -eq 0 ]] || die 'run this utility with sudo or as root'
}

require_paths() {
  [[ -f "$COMPOSE_FILE" ]] || die "compose file not found: $COMPOSE_FILE"
  [[ -f "$COMPOSE_ENV_FILE" ]] || die "compose env file not found: $COMPOSE_ENV_FILE"
  [[ -d "$DATA_DIR" ]] || die "data directory not found: $DATA_DIR"
  [[ -f "$DB_FILE" ]] || die "database not found: $DB_FILE"
  [[ "$RETENTION" =~ ^[1-9][0-9]*$ ]] || die 'HAIR_EXPO_BACKUP_RETENTION must be a positive integer'
  [[ "$BACKUP_DIR" == /var/backups/hair-expo || "$BACKUP_DIR" == /var/backups/hair-expo/* ]] || die 'backup directory must stay under /var/backups/hair-expo'
}

compose() {
  docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

backend_container() {
  local container
  container="$(compose ps -q backend)"
  [[ -n "$container" ]] || die 'backend container is not running'
  printf '%s\n' "$container"
}

checksum_file() {
  local file="$1"
  (cd "$(dirname "$file")" && sha256sum "$(basename "$file")" > "$(basename "$file").sha256")
}

verify_backup() {
  local file="$1"
  local checksum="$file.sha256"
  local container
  local staged_name=".hair-expo-verify-$$.sqlite"
  local staged_file="$DATA_DIR/$staged_name"

  [[ -f "$file" ]] || die "backup file not found: $file"
  [[ "$file" == "$BACKUP_DIR"/* ]] || die 'backup file must be inside the configured backup directory'
  [[ -f "$checksum" ]] || die "checksum file not found: $checksum"
  (cd "$(dirname "$file")" && sha256sum -c "$(basename "$checksum")")

  cp -- "$file" "$staged_file"
  chmod 600 "$staged_file"
  container="$(backend_container)"
  if docker exec -e VERIFY_NAME="$staged_name" "$container" node -e '
    const Database = require("better-sqlite3");
    const db = new Database(`/app/data/${process.env.VERIFY_NAME}`, { readonly: true, fileMustExist: true });
    try {
      db.pragma("foreign_keys = ON");
      const integrity = db.pragma("integrity_check", { simple: true });
      const foreignKeys = db.pragma("foreign_key_check");
      const requiredTables = [
        "schema_migrations", "products", "price_list_versions", "orders",
        "order_items", "checkout_operations", "checkout_attempts",
        "processed_webhook_events", "audit_records",
      ];
      const tableNames = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = ?").all("table").map((row) => row.name));
      const missingTables = requiredTables.filter((name) => !tableNames.has(name));
      const latestMigration = db.prepare("SELECT id FROM schema_migrations ORDER BY rowid DESC LIMIT 1").get()?.id ?? null;
      if (integrity !== "ok" || foreignKeys.length !== 0 || missingTables.length !== 0) {
        throw new Error(JSON.stringify({ integrity, foreignKeyViolations: foreignKeys.length, missingTables }));
      }
      console.log(JSON.stringify({ integrity, foreignKeyViolations: 0, latestMigration, orders: db.prepare("SELECT COUNT(*) AS count FROM orders").get().count }));
    } finally {
      db.close();
    }
  '; then
    rm -f -- "$staged_file"
  else
    local result=$?
    rm -f -- "$staged_file"
    return "$result"
  fi
}

latest_backup() {
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'hair-expo-*.sqlite' -printf '%T@ %p\n' 2>/dev/null \
    | sort -nr \
    | sed -n '1s/^[^ ]* //p'
}

prune_backups() {
  local -a backups
  local index
  mapfile -t backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'hair-expo-*.sqlite' -printf '%T@ %p\n' | sort -nr | sed 's/^[^ ]* //')
  for ((index = RETENTION; index < ${#backups[@]}; index++)); do
    rm -f -- "${backups[$index]}" "${backups[$index]}.sha256"
  done
}

create_backup() {
  local container
  local timestamp
  local temporary_name
  local temporary_file
  local backup_file

  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"
  container="$(backend_container)"
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  temporary_name=".hair-expo-backup-$timestamp.sqlite"
  temporary_file="$DATA_DIR/$temporary_name"
  backup_file="$BACKUP_DIR/hair-expo-$timestamp.sqlite"
  rm -f -- "$temporary_file"

  docker exec -e BACKUP_NAME="$temporary_name" "$container" node -e '
    const Database = require("better-sqlite3");
    const db = new Database("/app/data/hair-expo.sqlite", { readonly: true, fileMustExist: true });
    (async () => {
      try {
        await db.backup(`/app/data/${process.env.BACKUP_NAME}`);
      } finally {
        db.close();
      }
    })().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  '

  [[ -f "$temporary_file" ]] || die 'SQLite backup did not produce a file'
  cp -- "$temporary_file" "$backup_file"
  rm -f -- "$temporary_file"
  chmod 600 "$backup_file"
  checksum_file "$backup_file"
  verify_backup "$backup_file"
  prune_backups
  printf 'Backup verified: %s\n' "$backup_file"
}

show_status() {
  printf 'Live database: %s\n' "$DB_FILE"
  stat --printf='size=%s bytes modified=%y\n' "$DB_FILE"
  printf 'Backup directory: %s\n' "$BACKUP_DIR"
  find "$BACKUP_DIR" -maxdepth 1 -type f -name 'hair-expo-*.sqlite' -printf '%TY-%Tm-%Td %TH:%TM:%TS %s bytes %p\n' 2>/dev/null | sort -r || true
}

main() {
  local command="${1:-}"
  local file="${2:-}"

  require_root
  require_paths
  mkdir -p "$BACKUP_DIR"
  chmod 700 "$BACKUP_DIR"
  exec 9>"$LOCK_FILE"
  flock -n 9 || exit 0

  case "$command" in
    backup)
      create_backup
      ;;
    verify|restore-verify)
      [[ -n "$file" ]] || file="$(latest_backup)"
      [[ -n "$file" ]] || die 'no backup files found'
      verify_backup "$file"
      printf 'Restore rehearsal passed; production database was not changed.\n'
      ;;
    status)
      show_status
      ;;
    -h|--help|help)
      usage
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
}

main "$@"
