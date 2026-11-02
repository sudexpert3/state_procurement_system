# syntax=docker/dockerfile:1.7
#
# Production-сборка фронтенда (SPA). Файл лежит ВНЕ frontend/ — это не
# нарушает правило "не трогать frontend/", так как Dockerfile только читает
# файлы фронтенда внутри одноразового build-контейнера и ничего туда не пишет.
#
# Контекст сборки — корень репозитория (см. docker-compose.yml), поэтому все
# пути ниже начинаются с frontend/.

FROM node:22-alpine AS build
WORKDIR /app

# Отдельный слой для зависимостей — кэшируется, пока не меняются lock-файлы.
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Явный список файлов/папок вместо "COPY frontend/. ." — чтобы не затащить
# в контекст node_modules/dist разработчика фронтенда поверх уже
# установленных внутри контейнера (native-бинарники vite/esbuild из-под
# Windows/macOS несовместимы с linux-контейнером).
COPY frontend/index.html frontend/vite.config.ts frontend/tsconfig.json frontend/tsconfig.app.json frontend/tsconfig.node.json ./
COPY frontend/public ./public
COPY frontend/src ./src

# Базовый URL API зашивается в сборку на этапе build (Vite inlines import.meta.env.*).
# По умолчанию — относительный путь: в продакшене фронтенд и API отдаются
# одним nginx на одном домене (см. nginx/nginx.conf, location ~ ^/(api|...)).
# Для backend-dev профиля (без edge-nginx) переопределяется через
# FRONTEND_API_URL в .env — см. docker-compose.yml.
ARG VITE_API_URL=/api/
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html

# SPA-роутинг: неизвестные пути отдаём на index.html, дальше маршрутизирует react-router.
COPY <<'EOF' /etc/nginx/conf.d/default.conf
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

EXPOSE 80
