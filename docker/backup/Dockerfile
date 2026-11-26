# Та же версия, что сервер БД (postgres:15) — pg_dump должен совпадать по версии
# с сервером, иначе возможны предупреждения/несовместимость формата дампа.
FROM postgres:15

RUN apt-get update \
    && apt-get install -y --no-install-recommends cron tzdata \
    && rm -rf /var/lib/apt/lists/*

# Беларусь — чтобы "ежедневно в 20:00" означало 20:00 по местному времени,
# а не UTC (дефолт контейнера).
ENV TZ=Europe/Minsk
RUN ln -snf "/usr/share/zoneinfo/$TZ" /etc/localtime && echo "$TZ" > /etc/timezone

WORKDIR /app
COPY backup.sh /app/backup.sh
COPY crontab.txt /app/crontab.txt
RUN chmod +x /app/backup.sh \
    && crontab /app/crontab.txt

# Базовый образ postgres:15 своим ENTRYPOINT пытается инициализировать/запустить
# сервер БД — нам нужен только cron, поэтому ENTRYPOINT явно сбрасывается.
ENTRYPOINT []
CMD ["cron", "-f"]
