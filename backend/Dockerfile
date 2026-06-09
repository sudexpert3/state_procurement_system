FROM python:3.14-slim
LABEL authors="Kiromoto"

# Команда top работает бесконечно, удерживая контейнер «живым». На проде закоментить!!!
ENTRYPOINT ["top", "-b"]

# Устанавливает переменную окружения, которая гарантирует, что вывод из python будет отправлен прямо в терминал без предварительной буферизации
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt update && apt install -y --no-install-recommends && pip install --upgrade pip

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000





