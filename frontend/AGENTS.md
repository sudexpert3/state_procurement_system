# AGENTS.md

Единый источник правды для любого AI-агента, работающего в этом репозитории (Claude Code, OpenAI Codex, Gemini CLI, Cursor и т.д.).

`CLAUDE.md` и `GEMINI.md` импортируют этот файл. **Все правила проекта правим здесь** — в агенто-специфичных файлах держим только то, что касается конкретного инструмента.

---

## Рабочая директория

Работаем **только** внутри пакета `frontend/` — того каталога, где лежит этот файл. Не читать, не писать и не изменять файлы за его пределами (`backend/`, `nginx/`, корневой `docker-compose.yml` и прочее — чужая зона).

## Проект

Система учёта закупок (SPA). UI и все пользовательские сообщения — на русском языке. Комментарии в коде — на русском языке.

**Перед началом работы прочитай `docs/CurrentStatus.md`** — там актуальный статус фич проекта (что готово, что на моках, что не реализовано). Обновляй его по завершении крупных фич/сессий.

## Актуальная документация

При работе с библиотекой, фреймворком, SDK, API или CLI сначала запрашивай актуальную документацию через Context7: определи библиотеку через `resolve_library_id`, затем используй `query_docs`. Не заменяй Context7 памятью модели, если инструмент доступен.

## Команды

```bash
npm run dev             # dev-сервер
npm run build           # tsc -b && vite build
npm run lint            # ESLint
npm run lint:fix        # ESLint --fix + prettier --write
npm run format          # prettier --write .
npm run type-check      # tsc --noEmit
npm run generate-types  # регенерация типов из OpenAPI (бэкенд должен быть запущен на localhost:8000)
```

Husky + lint-staged запускает ESLint + Prettier автоматически на коммит. Никогда не пропускать хуки (`--no-verify`).

## Definition of Done

Задача не считается выполненной, пока не прошли обе команды:

```bash
npm run type-check && npm run lint
```

Агент обязан запустить их сам и показать результат. «Вроде работает» — не результат.

---

## Параллельная работа нескольких агентов

В репозитории одновременно могут работать несколько агентов (Claude, Codex, Gemini). Чтобы не перезаписывать изменения друг друга:

```
                    main (origin)
                        |
     +------------------+------------------+
     |                  |                  |
 worktree A         worktree B         worktree C
 feature/table      feature/auth       fix/imports
 [агент 1]          [агент 2]          [агент 3]
```

**Правила:**

1. **Один агент = один git worktree = одна ветка.** Не запускать двух агентов в одном рабочем каталоге.
   ```bash
   git worktree add ../sps-<задача> -b feature/<задача>
   ```
2. **Не трогать файлы вне своей задачи.** Заметил проблему в чужой зоне — сообщи в отчёте, не правь молча.
3. **Перед стартом работы** синхронизироваться с базовой веткой: `git fetch && git rebase origin/main`.
4. **Общие файлы — точка конфликта.** Особая осторожность с: `package.json`, `package-lock.json`, `src/shared/api/schema/generated.ts`, `src/app/global.css`, `docs/CurrentStatus.md`. Меняешь такой файл — явно напиши об этом в отчёте.
5. **Коммитить только зелёный код** (`type-check` + `lint` прошли). Коммиты атомарные, сообщение — по существу.
6. **Не делать `git push --force` в общие ветки** и не переписывать чужую историю.

---

## Архитектура

Правила архитектуры проекта (структура директорий, правила импортов, эволюция модулей) — в **`docs/architecture.md`**. Это обязательные правила, соблюдать при любой работе с файлами и импортами. ESLint-плагин `boundaries` (`eslint.boundaries.js`) проверяет их автоматически.

## API

Использовать `openapi-fetch` + `openapi-react-query`. Клиенты — в `src/shared/api/instance.ts`.

```ts
import { rqClient } from "@/shared/api/instance";
```

Типы генерируются в `src/shared/api/schema/generated.ts`, экспорты типов — в `src/shared/api/schema/index.ts`. После изменений бэкенда — `npm run generate-types`. **Руками сгенерированные типы не править.**

Auth: Bearer-токен из `localStorage.getItem("token")`, подставляется middleware в `instance.ts`.

## Формы и валидация

React Hook Form + Zod **v4**. Схемы — рядом с фичей. Для строковых инпутов использовать `z.coerce.number()` / `z.coerce.date()`. Сообщения об ошибках — на русском языке.

API Zod v4 отличается от v3 (`error` вместо `message`, deprecated-методы, coerce/preprocess/transform, типы для RHF). Подробности и примеры — в **`docs/zod-v4.md`**, открывать при работе со схемами валидации.

## UI-компоненты

shadcn/ui (стиль: `radix-nova`). Добавлять компоненты через:

```bash
npx shadcn add <component>
```

Компоненты попадают в `src/shared/components/ui/` (алиасы — в `components.json`). TailwindCSS v4 (конфиг — в `src/app/global.css`, без `tailwind.config.js`). Сортировка классов — `prettier-plugin-tailwindcss`.

## Таблицы

TanStack Table v8. Обязательная мемоизация `data`/`columns`, паттерны column definitions, серверная vs клиентская обработка, row selection — в **`docs/tanstack-table.md`**, открывать при работе с таблицами.

## Глобальный state

Zustand. Структура стора, паттерн `create<T>()()`, selector-паттерны, slice pattern, что не класть в стор — в **`docs/zustand.md`**, открывать при работе с глобальным state.

---

## TypeScript

- Strict + `noUncheckedIndexedAccess` — всегда обрабатывать `undefined` при индексированном доступе
- `erasableSyntaxOnly: true` — **не использовать `enum`**, заменять на `as const`-объекты
- **Не использовать `console.*`** (ESLint-ошибка)
- Порядок импортов — `eslint-plugin-simple-import-sort`; type-only импорты — `import type`
- Path alias: `@/` → `src/`
- Избегать `any` и `@ts-ignore`. Нужен побег из типов — `unknown` + сужение.

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

## Переменные окружения

Создать `.env.local` (в gitignore):

```
VITE_API_URL=        # base URL бэкенд REST API
VITE_GPZ_USERNAME=   # credentials для goszakupki.by
VITE_GPZ_PASSWORD=
VITE_GPZ_URL=        # base URL goszakupki.by
```

**Секреты никогда не коммитить** и не выводить в чат/логи.

---

## Как работать (методология)

**Plan → Do → Verify.**

1. **План** — разберись в задаче (прочитай код и релевантные `docs/*.md`), определи критерии проверки. Крупная задача → сначала план и уточняющие вопросы, потом код.
2. **Выполнение** — следуй плану. Упёрся в проблему — вернись к плану, а не импровизируй молча.
3. **Проверка** — прогони `npm run type-check && npm run lint`, перечисли что проверил. Нет проверки — не готово.

**Не выдумывай.** Не знаешь — скажи прямо, посмотри в код или спроси. Выдуманные API, файлы и флаги хуже, чем «не знаю».
