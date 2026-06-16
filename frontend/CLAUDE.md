# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Рабочая директория

**Работаем ТОЛЬКО в папке `D:\projects\state_procurement_system\frontend`.** Не выходить за её пределы — не читать, не писать, не изменять файлы вне этой папки.

## Проект

Система учёта закупок (SPA). UI и все пользовательские сообщения — на русском языке. Комментарии в коде — на русском языке.

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

## Архитектура: Evolution Design (ED Small)

Проект использует методологию [Evolution Design](https://ed.evocomm.space/guide/). Модификация ED Small — до 12 человеко/месяцев, 1-2 разработчика.

```
src/
  app/       # точка входа, роутинг, провайдеры, глобальная конфигурация
  features/  # крупные независимые функциональные блоки (3-4 большие фичи)
  services/  # переиспользуемая бизнес-логика между фичами (при необходимости)
  shared/
    domain/  # глобальные бизнес-типы
    model/   # глобальное состояние
    ui/      # UI-компоненты (shadcn → src/shared/ui/kit/)
    api/     # API-клиент и сгенерированные типы
    lib/     # инфраструктура
```

**Правила импортов:**

- `app` → может импортировать из features, services, shared
- `features` → только из services и shared (не из app, не из других features)
- `services` → только из services и shared
- `shared` → только внутри shared

**Модули эволюционируют по 4 этапам:**

1. Single file (до 400 строк)
2. Flat module (до 6 файлов, public API через `index.ts`)
3. Grouped module (группы `ui/`, `model/`, `api/`, `lib/` — без обязательного public API)
4. Module with Compose (слабая связность через события/DI/слоты)

Начинать с простого, усложнять по необходимости. Не создавать папки `hooks/` или `components/` — называть по смыслу.

## API

Использовать `openapi-fetch` + `openapi-react-query`. Клиенты — в `src/shared/api/instance.ts`.

```ts
import { rqClient } from "@/shared/api/instance";
```

Типы генерируются в `src/shared/api/types/api.ts`. После изменений бэкенда — запустить `npm run generate-types`.

**`src/shared/api/crud-service.ts` — устаревший Axios-модуль. Не использовать для нового кода.**

Auth: Bearer-токен из `localStorage.getItem("token")`, подставляется middleware в `instance.ts`.

Dev proxy: `/api-goszakupki` → `https://api.goszakupki.by`.

## Формы и валидация

React Hook Form + Zod v4. Схемы — рядом с фичей. Для строковых инпутов использовать `z.coerce.number()` / `z.coerce.date()`. Сообщения об ошибках — на русском языке.

## UI-компоненты

shadcn/ui (стиль: `radix-nova`). Добавлять компоненты через:

```bash
npx shadcn add <component>
```

Компоненты попадают в `src/shared/ui/kit/`. TailwindCSS v4 (конфиг — в `src/app/global.css`, без `tailwind.config.js`). Сортировка классов — `prettier-plugin-tailwindcss`.

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

| Ситуация | Вместо Effect |
|---|---|
| Вычислить из state/props | Переменная при рендере |
| Реакция на событие | Обработчик события |
| Дорогое вычисление | `useMemo` |
| Сбросить state при смене prop | `key={propValue}` |

```tsx
// ❌ Антипаттерн
useEffect(() => { setFull(first + ' ' + last); }, [first, last]);
// ✅ Правильно
const full = first + ' ' + last;

// ❌ Антипаттерн — сброс state через Effect
useEffect(() => { setComment(''); }, [userId]);
// ✅ Правильно
<Profile userId={userId} key={userId} />
```

Effect нужен только для синхронизации с внешней системой (WebSocket, DOM API, подписки). Всегда добавлять cleanup и защиту от race condition:

```tsx
useEffect(() => {
  let ignore = false;
  fetchData(query).then(data => { if (!ignore) setResults(data); });
  return () => { ignore = true; };
}, [query]);
```

### State

- Если можно вычислить из state/props — это не state
- State живёт в ближайшем общем родителе (lifting up)
- Не поднимать state выше, чем нужно — медленный state изолировать в дочернем компоненте
- `children` как prop — обёртка со своим state не ре-рендерит `children`

---

## Zod v4 — best practices

Проект использует Zod **v4**. API отличается от v3.

### Сообщения об ошибках: `error`, не `message`

```ts
// ✅ v4
z.string().min(1, { error: "Обязательное поле" })
z.coerce.number({ error: "Должно быть числом" })
z.string().min(1, "Обязательное поле") // краткая форма тоже работает

// ❌ v3 — не использовать
z.string().min(1, { message: "..." })
```

### Deprecated API — не использовать в новом коде

| Deprecated | Замена |
|---|---|
| `z.string().email()` | `z.email()` |
| `A.merge(B)` | `A.extend(B.shape)` |
| `z.nativeEnum(E)` | `z.enum(E)` (принимает `as const` объекты) |
| `z.setErrorMap()` | `z.config({ error: ... })` |
| `err.format()` / `err.flatten()` | `z.treeifyError(err)` / `z.flattenError(err)` |

### Compose-паттерны

```ts
const Extended = Base.extend({ extra: z.string() });
const Merged   = A.extend(B.shape);             // вместо A.merge(B)
const Picked   = Schema.pick({ name: true });
const Omitted  = Schema.omit({ password: true });
const Partial  = Schema.partial();
```

### coerce vs preprocess vs transform

```ts
// coerce — для строковых инпутов форм (правило проекта)
z.coerce.number({ error: "Должно быть числом" }).positive()
z.coerce.date({ error: "Введите дату" })

// preprocess — нестандартные случаи (пустая строка → undefined)
z.preprocess((val) => val === "" ? undefined : val, z.string().optional())

// transform — меняет тип ПОСЛЕ валидации
z.string().transform(s => s.trim().toLowerCase())
```

### Типы для React Hook Form

```ts
// z.input<T> — тип для defaultValues (то, что вводит пользователь)
// z.output<T> / z.infer<T> — тип для onSubmit (после coerce/transform)
type FormInput  = z.input<typeof schema>;
type FormOutput = z.infer<typeof schema>;
```

### refine / superRefine

```ts
// Кросс-полевая валидация
const schema = z.object({ password: z.string(), confirm: z.string() })
  .refine(d => d.password === d.confirm, {
    error: "Пароли не совпадают",
    path: ["confirm"],
  });

// Несколько ошибок
.superRefine((d, ctx) => {
  if (d.end <= d.start) ctx.addIssue({ code: "custom", message: "...", path: ["end"] });
});
```

---

## TanStack Table v8 — best practices

### Обязательная мемоизация

```ts
// data и columns ВСЕГДА мемоизировать — нестабильные ссылки = бесконечные ре-рендеры
const data    = useMemo(() => response?.items ?? [], [response]);
const columns = useMemo<ColumnDef<Contract>[]>(() => [...], []);
// useReactTable() НЕ мемоизировать
```

### Column definitions

```ts
const columns: ColumnDef<Contract>[] = [
  {
    accessorKey: "title",         // для плоских полей (TypeScript проверяет ключ)
    header: "Наименование",
    cell: ({ getValue }) => <span>{getValue<string>()}</span>,
  },
  {
    accessorFn: row => row.amount * 1.2,  // для вычисляемых/вложенных — требует id
    id: "amountWithTax",
    header: ({ column }) => (
      <button onClick={column.getToggleSortingHandler()}>Сумма</button>
    ),
  },
];
```

### Серверная vs клиентская обработка

| Режим | Когда | Настройка |
|---|---|---|
| Клиентская | < 1000 строк | `getSortedRowModel()`, `getPaginationRowModel()` |
| Серверная | > 1000 строк, API пагинирует | `manualSorting/Pagination/Filtering: true` + `rowCount` |

```ts
// Серверный режим
const table = useReactTable({
  data, columns,
  getCoreRowModel: getCoreRowModel(),
  manualSorting: true,
  manualPagination: true,
  manualFiltering: true,
  rowCount: totalCount,            // обязательно для серверной пагинации
  state: { sorting, pagination, columnFilters },
  onSortingChange: setSorting,     // изменение → новый запрос к API
  onPaginationChange: setPagination,
});
```

### Row selection (стандартный паттерн)

```ts
const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

// Колонка-чекбокс
{
  id: "select",
  header: ({ table }) => (
    <Checkbox checked={table.getIsAllPageRowsSelected()}
      onCheckedChange={v => table.toggleAllPageRowsSelected(!!v)} />
  ),
  cell: ({ row }) => (
    <Checkbox checked={row.getIsSelected()} disabled={!row.getCanSelect()}
      onCheckedChange={row.getToggleSelectedHandler()} />
  ),
}

// Получить выбранные строки:
table.getSelectedRowModel().rows.map(r => r.original)
```

- Подключать только нужные row models — каждый влияет на бандл
- Всегда типизировать: `ColumnDef<T>`, не `ColumnDef<unknown>`

---

## Zustand — best practices

### Actions внутри стора

```ts
interface Store {
  bears: number
  increase: () => void
  reset: () => void
}

const useStore = create<Store>()((set) => ({
  bears: 0,
  increase: () => set(s => ({ bears: s.bears + 1 })),
  reset: () => set({ bears: 0 }),
}))
```

### TypeScript: обязательный двойной вызов `create<T>()()`

```ts
// ✅ Правильно — с middleware
const useStore = create<State>()(
  devtools(persist((set) => ({ ... }), { name: 'my-store' }), { name: 'MyStore' })
)
// ❌ create<State>(...) — типы сломаются при middleware
```

### Selector-паттерны — избегать лишних ре-рендеров

```ts
// ❌ Плохо — новый объект на каждый рендер = всегда ре-рендер
const { nuts, honey } = useFoodStore()

// ✅ Атомарные селекторы
const nuts  = useFoodStore(s => s.nuts)
const honey = useFoodStore(s => s.honey)

// ✅ useShallow — для нескольких полей сразу
import { useShallow } from 'zustand/react/shallow'
const { nuts, honey } = useFoodStore(useShallow(s => ({ nuts: s.nuts, honey: s.honey })))
```

### Slice pattern для большого стора

```ts
// bearSlice.ts
export interface BearSlice { bears: number; addBear: () => void }
export const createBearSlice = (set: any): BearSlice => ({
  bears: 0,
  addBear: () => set((s: BearSlice) => ({ bears: s.bears + 1 })),
})

// store.ts
export const useStore = create<BearSlice & FishSlice>()((...a) => ({
  ...createBearSlice(...a),
  ...createFishSlice(...a),
}))
```

### Что НЕ класть в глобальный стор

| Что | Где хранить |
|---|---|
| Данные с сервера | `@tanstack/react-query` |
| Состояние форм | React Hook Form |
| Локальный UI-state компонента | `useState` |
| Производные/вычисляемые значения | Считать в компоненте или в селекторе |

### Когда Zustand, когда useState

- **useState/useReducer** — состояние одного компонента, локальная форма
- **Zustand** — состояние нескольких несвязанных компонентов, auth, UI-флаги (sidebar), фильтры таблиц

---

## Переменные окружения

Создать `.env.local` (в gitignore):

```
VITE_API_URL=        # base URL бэкенд REST API
VITE_GPZ_USERNAME=   # credentials для goszakupki.by
VITE_GPZ_PASSWORD=
VITE_GPZ_URL=        # base URL goszakupki.by
```
