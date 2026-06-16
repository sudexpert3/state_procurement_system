---
name: new-feature
description: Создаёт новый функциональный блок в src/features/ по методологии Evolution Design. Вызывай когда нужно добавить новую фичу в проект.
disable-model-invocation: true
---

Создай новый модуль фичи в `src/features/` по методологии Evolution Design (ED Small).

Аргумент: $ARGUMENTS (имя фичи, например: `auth`, `reports`, `contracts`)

## Шаги

1. **Определи этап модуля** — начинай с Flat Module (этап 2), если фича явно маленькая — Single File (этап 1).

2. **Flat Module** (до 6 файлов, `index.ts` обязателен):

   ```
   src/features/<name>/
     index.ts              # public API — реэкспортирует только то, что нужно снаружи
     <name>.page.tsx       # страница (если есть роут)
     use-<name>.ts         # основной хук (если нужен)
     api.ts                # запросы через rqClient из @/shared/api/instance
   ```

3. **Grouped Module** (если сразу понятно что будет > 6 файлов):

   ```
   src/features/<name>/
     index.ts
     ui/                   # компоненты
     model/                # хуки, стейт, бизнес-логика
     api/                  # API-запросы
   ```

4. **Правила:**
   - Импортировать только из `@/services/` и `@/shared/` — **никогда из других features**
   - Не создавать папки `hooks/` или `components/` — называть по смыслу
   - `index.ts` экспортирует только публичный API фичи
   - Новый роут подключить в `src/app/router.tsx`

5. **Создай файлы** с минимальным boilerplate, оставь TODO-комментарии на русском для логики которую нужно реализовать.

6. Сообщи какие файлы созданы и что нужно реализовать.
