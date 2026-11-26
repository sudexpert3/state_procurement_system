#!/bin/sh
# Снимает резервную копию БД (pg_dump, формат -Fc — сжатый, восстанавливается
# через pg_restore) и удаляет копии старше BACKUP_RETENTION_DAYS дней.
# Запускается по расписанию cron'ом (см. crontab.txt) внутри контейнера backup
# (docker-compose.yml) — учётные данные БД берутся из переменных окружения,
# которые задаёт сам сервис backup в docker-compose.yml (DB_HOST=db внутри
# docker-сети, не адрес для доступа с хоста).
set -eu

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.dump"

mkdir -p "$BACKUP_DIR"

export PGPASSWORD="$DB_PASSWORD"

echo "[$(date -Iseconds)] Начало резервного копирования БД '${DB_NAME}' -> $FILE"
pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -Fc -f "$FILE" "$DB_NAME"
echo "[$(date -Iseconds)] Резервная копия создана, размер: $(du -h "$FILE" | cut -f1)"

# Ротация: удаляем дампы старше RETENTION_DAYS дней — ВАЖНО, что этот шаг идёт
# ПОСЛЕ успешного pg_dump (set -e прервёт скрипт раньше при ошибке дампа) —
# если сегодняшняя копия не создалась, старые копии не удаляются, подушка
# безопасности сохраняется.
DELETED=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "${DB_NAME}_*.dump" -mtime +"$RETENTION_DAYS" -print -delete)
if [ -n "$DELETED" ]; then
  echo "[$(date -Iseconds)] Удалены копии старше ${RETENTION_DAYS} дн.:"
  echo "$DELETED"
fi

echo "[$(date -Iseconds)] Резервное копирование завершено."
