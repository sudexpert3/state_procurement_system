---
name: generate-types
description: Воркфлоу регенерации TypeScript-типов из OpenAPI-спецификации бэкенда. Вызывай после изменений на бэкенде.
disable-model-invocation: true
---

Регенерируй API-типы из OpenAPI-спецификации бэкенда.

## Шаги

1. **Убедись что бэкенд запущен** на `localhost:8000`. Проверь:

   ```bash
   curl -s http://localhost:8000/openapi.json | head -5
   ```

   Если бэкенд недоступен — сообщи пользователю и остановись.

2. **Запусти генерацию:**

   ```bash
   npm run generate-types
   ```

   Это обновит `src/shared/api/types/api.ts`.

3. **Проверь типы:**

   ```bash
   npm run type-check
   ```

4. **Если есть ошибки типов** — покажи их пользователю и предложи исправить места использования в коде.

5. Сообщи сколько изменений в `api.ts` и есть ли breaking changes (удалённые/переименованные поля).
