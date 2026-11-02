# architecture.md

Правила архитектуры проекта. Импортируется из `CLAUDE.md` — читать как обязательные правила, а не как справочную информацию.

## Методология: Evolution Design (ED Small)

Проект использует методологию [Evolution Design](https://ed.evocomm.space/guide/). Модификация ED Small — до 12 человеко/месяцев, 1-2 разработчика.

## Структура директорий

```
src/
  app/       # точка входа, роутинг, провайдеры, глобальная конфигурация
  features/  # крупные независимые функциональные блоки
  services/  # переиспользуемая бизнес-логика между фичами (создаётся при необходимости, сейчас не создана)
  shared/
    model/       # глобальное состояние (env, routes)
    components/
      ui/        # UI-компоненты shadcn (алиас "ui" из components.json → @/shared/components/ui)
      data-table/
      form/
    api/         # API-клиент и сгенерированные типы
    lib/
      helpers/   # общие хелперы (функции)
      react/     # общие хуки для проекта (алиас "hooks" → @/shared/lib/react)
      utils.ts   # утилита cn
```

Пути алиасов заданы в `components.json` (`ui`, `components`, `lib`, `hooks`, `utils`) — при добавлении shadcn-компонентов (`npx shadcn add <component>`) они попадают строго по этим алиасам, руками не переносить.

## Правила импортов

- `app` → может импортировать из `features`, `services`, `shared`
- `features` → только из `services` и `shared` (не из `app`, не из других `features`)
- `services` → только из `services` и `shared`
- `shared` → только внутри `shared`

Границы enforce'ятся `eslint.boundaries.js` — нарушение правил импорта будет ошибкой линта.

## Эволюция модулей (4 этапа)

1. **Single file** — до 400 строк
2. **Flat module** — до 6 файлов, публичный API через `index.ts`
3. **Grouped module** — группы `ui/`, `model/`, `api/`, `lib/` — без обязательного `index.ts`
4. **Module with Compose** — слабая связность через события/DI/слоты

Начинать с простого (этап 1), усложнять по необходимости. Не создавать папки `hooks/` или `components/` внутри фичи — называть по смыслу (например `form/`, `detail/`, `list/`).
