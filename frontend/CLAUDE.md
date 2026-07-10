# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Рабочая директория

**Работаем ТОЛЬКО в папке `D:\projects\state_procurement_system\frontend`.** Не выходить за её пределы — не читать, не писать, не изменять файлы вне этой папки.

## Проект

Система учёта закупок (SPA). UI и все пользовательские сообщения — на русском языке. Комментарии в коде — на русском языке.

**Перед началом работы прочитай `docs/CurrentStatus.md`** — там актуальный статус фич проекта (что готово, что на моках, что не реализовано). Обновляй его по завершении крупных фич/сессий.

## Команды

```bash
npm run dev           # dev-сервер
npm run build         # tsc -b && vite build
npm run lint          # ESLint
npm run lint:fix      # ESLint --fix + prettier --write
npm run format        # prettier --write .
npm run type-check    # tsc --noEmit
npm run generate-types  # регенерация src/shared/api/types/api.ts из OpenAPI (бэкенд должен быть запущен на localhost:8000)
```

Husky + lint-staged запускает ESLint + Prettier автоматически на коммит. Никогда не пропускать хуки (`--no-verify`).

## Архитектура

Правила архитектуры проекта (структура директорий, правила импортов, эволюция модулей) — в `docs/architecture.md`. Это обязательные правила, соблюдать при любой работе с файлами и импортами.

## API

Использовать `openapi-fetch` + `openapi-react-query`. Клиенты — в `src/shared/api/instance.ts`.

```ts
import { rqClient } from "@/shared/api/instance";
```

Типы генерируются в `src/shared/api/schema/generated.ts`, экспорты типов лежат в `src/shared/api/schema/index.ts`. После изменений бэкенда — запустить `npm run generate-types`.

Auth: Bearer-токен из `localStorage.getItem("token")`, подставляется middleware в `instance.ts`.

## Формы и валидация

React Hook Form + Zod v4. Схемы — рядом с фичей. Для строковых инпутов использовать `z.coerce.number()` / `z.coerce.date()`. Сообщения об ошибках — на русском языке.

## UI-компоненты

shadcn/ui (стиль: `radix-nova`). Добавлять компоненты через:

```bash
npx shadcn add <component>
```

Компоненты попадают в `src/shared/components/ui/` (алиасы заданы в `components.json`). TailwindCSS v4 (конфиг — в `src/app/global.css`, без `tailwind.config.js`). Сортировка классов — `prettier-plugin-tailwindcss`.

## TypeScript

- Strict + `noUncheckedIndexedAccess` — всегда обрабатывать `undefined` при индексированном доступе
- `erasableSyntaxOnly: true` — **не использовать `enum`**, заменять на `as const`-объекты
- Не использовать `console.*` (ESLint-ошибка)
- Порядок импортов — `eslint-plugin-simple-import-sort`; type-only импорты — `import type`
- Path alias: `@/` → `src/`

## React — best practices

### memo / useMemo / useCallback

Применять **только** если:

1. Дочерний компонент обёрнут в `memo()` и пропс — функция/объект
2. Значение — зависимость `useEffect`
3. Вычисление реально дорогое (измерено)

```tsx
// НУЖНО: Child в memo() + нестабильная ссылка
const Child = memo(function Child({ onClick }: { onClick: () => void }) { ... });
function Parent({ id }: { id: number }) {
  const handleClick = useCallback(() => post('/api/' + id), [id]);
  return <Child onClick={handleClick} />;
}

// НЕ НУЖНО: Child не в memo() — useCallback бесполезен
```

- `memo()` сломается, если пропс-объект не обёрнут в `useMemo`
- Для обновления state внутри `useCallback` использовать updater-форму: `setState(s => [...s, item])`

### useEffect — когда НЕ нужен

| Ситуация                      | Вместо Effect          |
| ----------------------------- | ---------------------- |
| Вычислить из state/props      | Переменная при рендере |
| Реакция на событие            | Обработчик события     |
| Дорогое вычисление            | `useMemo`              |
| Сбросить state при смене prop | `key={propValue}`      |

```tsx
// ❌ Антипаттерн
useEffect(() => {
  setFull(first + " " + last);
}, [first, last]);
// ✅ Правильно
const full = first + " " + last;

// ❌ Антипаттерн — сброс state через Effect
useEffect(() => {
  setComment("");
}, [userId]);
// ✅ Правильно
<Profile userId={userId} key={userId} />;
```

Effect нужен только для синхронизации с внешней системой (WebSocket, DOM API, подписки). Всегда добавлять cleanup и защиту от race condition:

```tsx
useEffect(() => {
  let ignore = false;
  fetchData(query).then((data) => {
    if (!ignore) setResults(data);
  });
  return () => {
    ignore = true;
  };
}, [query]);
```

### State

- Если можно вычислить из state/props — это не state
- State живёт в ближайшем общем родителе (lifting up)
- Не поднимать state выше, чем нужно — медленный state изолировать в дочернем компоненте
- `children` как prop — обёртка со своим state не ре-рендерит `children`

---

## Zod v4 — best practices

Проект использует Zod **v4**, API отличается от v3 (`error` вместо `message`, deprecated-методы, coerce/preprocess/transform, типы для RHF). Подробности и примеры кода — в `docs/zod-v4.md`, открывать при работе со схемами валидации.

## TanStack Table v8 — best practices

Обязательная мемоизация `data`/`columns`, паттерны column definitions, серверная vs клиентская обработка, row selection. Подробности и примеры кода — в `docs/tanstack-table.md`, открывать при работе с таблицами.

## Zustand — best practices

Структура стора, паттерн `create<T>()()`, selector-паттерны, slice pattern, что не класть в стор. Подробности и примеры кода — в `docs/zustand.md`, открывать при работе с глобальным state.

---

## Переменные окружения

Создать `.env.local` (в gitignore):

```
VITE_API_URL=        # base URL бэкенд REST API
VITE_GPZ_USERNAME=   # credentials для goszakupki.by
VITE_GPZ_PASSWORD=
VITE_GPZ_URL=        # base URL goszakupki.by
```
