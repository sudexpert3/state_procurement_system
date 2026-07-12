# CurrentStatus.md — статус проекта для AI-агентов

> Служебный файл. Обновляй его при завершении крупных фич/сессий, чтобы не перечитывать весь проект заново.
> Дата последней актуализации: 2026-07-12, ветка `feature/inner-codes`.

## Стек

- React 19 + React Router 7 (data router, `lazy` per-route)
- shadcn/ui (компоненты лежат в `src/shared/components/ui/`)
- Zod v4 + React Hook Form
- TanStack Query v5 (`openapi-react-query` через `rqClient`) + TanStack Table v8
- TailwindCSS v4

## Структура (фактическая)

```
src/
  app/           # router.tsx, main-layout, protected-route, providers
  features/      # см. статус фич ниже
  shared/
    api/         # instance.ts (rqClient), query-client.ts, schema/ (генерируется)
    components/
      data-table/  # общий DataTable на tanstack-table
      form/
      ui/          # shadcn-компоненты
    lib/helpers/, lib/react/
    model/routes.ts   # ROUTES + типизация path-параметров
    model/status.ts   # StatusFilterValue ("all" | "true" | "false")
```

Модуля `services/` пока нет — переиспользуемой бизнес-логики между фичами не выделялось.

## Общий `DataTable` (`shared/components/data-table/data-table.tsx`)

Один компонент покрывает все таблицы проекта. Что умеет (все режимы опциональны):

- **Серверная пагинация** — проп `pagination.manual` (`pageIndex`/`pageSize`/`rowCount`/`onChange`). Без него — клиентская.
- **Древовидные строки** — `getSubRows` (включает `getExpandedRowModel`, `paginateExpandedRows: false`, `filterFromLeafRows: true`) + `forceExpanded` для авто-раскрытия групп во время поиска.
- **Поиск** — внешний `globalFilter` (клиентская фильтрация) либо `manualFiltering` для серверного.
- Видимость колонок, сортировка, `actions(table)` для тулбара.

## Статус фич по разделам сайдбара

| Раздел (label в сайдбаре)         | Роут                      | Фича                             | Статус                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------- | ------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Годовые планы                     | `/plans`                  | `features/plans`                 | ✅ Готово. Таблица через `DataTable`, реальный API (`GET /api/purchases/`), клик по строке → переход в реестр закупок с фильтром по плану. CRUD/drawer не реализован (пока read-only реестр)                                                                                                                                                                                                                                        |
| Реестр закупок                    | `/plan-items`             | `features/plan-items/list`       | 🟡 Таблица, колонки с видимостью, реальный API. Серверная пагинация (`limit`/`offset` в URL, `manual` в `DataTable`) и серверный поиск (`search` + debounce 500мс) подключены 2026-07-12. **Хвосты:** поиск на бэке реализован плохо — переделать после доработки эндпоинта (`TODO` в `plans-items.page.tsx`); `ordering` на бэке нет, поэтому сортировка колонок не включена (клиентская сортировала бы только текущую страницу); query-параметр `purchase` фронт шлёт, но в OpenAPI-схеме `/api/plan_items/` его нет — проверить, не игнорит ли бэк фильтр по плану |
| Реестр закупок → карточка         | `/plan-items/:id`         | `features/plan-items/detail`     | 🟡 Частично. Таб «Информация» — реальный API (`plan-items/{id}/`). Табы «Планирование» и «Договоры» ещё на моках (`procurement.mock.ts`, `plan2`). Таб «Платежи» — заглушка-текст, эндпоинт не подключён. Статус плана (Badge) закомментирован — ждём уточнения от бэка (`//TODO узнать про статус плана`)                                                                                                                            |
| Реестр закупок → создание         | `/plan-items/add`         | `features/plan-items/create`     | 🟡 Форма готова визуально (табы: основная информация, планирование, договоры с quarter-table на 30 договоров через drawer), но `onSubmit` НЕ отправляет на бэкенд — просто `toast.info` + локальный state. Раздел договоров использует моки (`contracts.mock.ts`)                                                                                                                                                                    |
| ЭКР (экономическая классификация) | `/economic-code`          | `features/economic-code`         | ✅ Готово. Переписана 2026-07-12 по паттерну `code-okrb`: реальный API (`/api/economic_code/`, тип `EconomicCode` = `ExternalEconomicCode`), drawer CRUD, серверный поиск + серверный фильтр по `is_active`, сортировка. Справочник плоский — иерархии в API нет                                                                                                                                                                     |
| Внутренние коды ЭКР               | `/internal-economic-code` | `features/internal-economic-code` | ✅ Готово (2026-07-12). Реальный API (`/api/internal_economic_code/`), **древовидный** справочник: `sub_codes` → `getSubRows` в `DataTable`, авто-раскрытие групп при поиске (`forceExpanded`). Поиск серверный (debounce 500мс), фильтр по статусу — клиентский (`filterTreeByStatus`, рекурсивно, родитель остаётся если подошёл потомок). Drawer CRUD, выбор родителя из плоского списка (`flattenTree`). **Хвост:** каст `as unknown as InternalEconomicCode[]` — в сгенерированной схеме `sub_codes` пока `string`, убрать после доработки бэка |
| Коды ОКРБ                         | `/codes-okrb`             | `features/code-okrb`             | ✅ Готово. Плоский справочник, drawer CRUD + delete-dialog, реальный API                                                                                                                                                                                                                                                                                                                                                           |
| Главки                            | `/departments`            | `features/departments`           | ✅ Готово. **Древовидный** справочник (`sub_departments`), тот же паттерн, что и внутренние коды ЭКР. Отличие: поиск **клиентский** (`globalFilter` внутри tanstack-table), фильтр по статусу тоже клиентский. Так сделано намеренно, пока на бэке не допилят нормальный серверный поиск по справочникам — см. блок хвостов ниже. Тот же временный каст из-за `sub_departments: string` в схеме                                       |
| Закупщики                         | `/buyers`                 | `features/buyers`                | ✅ Готово. Плоский справочник, тот же паттерн, реальный API                                                                                                                                                                                                                                                                                                                                                                        |
| Поставщики                        | `/suppliers`              | `features/suppliers`             | ✅ Готово. Плоский справочник, тот же паттерн, реальный API                                                                                                                                                                                                                                                                                                                                                                        |
| Корректировка лимитов             | —                         | —                                | ❌ Не реализовано, пункт в сайдбаре без роута (`url: "#"`)                                                                                                                                                                                                                                                                                                                                                                         |
| Авторизация                       | `/login`                  | `features/auth`                  | ✅ Есть login-форма и `ProtectedRoute` (bearer-токен из localStorage)                                                                                                                                                                                                                                                                                                                                                              |

## Общий CRUD-паттерн справочников

Все справочники (ЭКР, внутренние ЭКР, ОКРБ, главки, закупщики, поставщики) сделаны одинаково — если добавляется новый, копировать этот паттерн:

- `<name>.page.tsx` — `Card` + `DataTable` + `drawerOpen`/`editingItem` state
- `<name>-toolbar.tsx` + `<name>-filter.tsx` — поиск и фильтр по статусу (`StatusFilterValue`)
- `<name>-form.tsx` (или `form/<name>-form.tsx`) — форма в Drawer (create/update)
- `<name>.schema.ts` — Zod-схема
- `columns.tsx` — фабрика `createColumns(handleEdit, handleDelete, deletingId)`
- `hooks/use-<name>.ts` — query + поиск + фильтр + `invalidate`; `hooks/use-<name>-delete.ts` — удаление через confirm-dialog

Для древовидных справочников (главки, внутренние ЭКР) в хуке дополнительно живут `flattenTree` (плоский список для выбора родителя в форме) и `filterTreeByStatus` (рекурсивный фильтр по статусу).

## Что нужно знать перед следующей задачей

- **Незакрытые хвосты бэка**, из-за которых стоят касты и `TODO`:
  - `sub_codes` / `sub_departments` в OpenAPI-схеме типизированы как `string`, а приходит массив узлов → в `use-internal-economic-code.ts` и `use-departments.ts` стоит `as unknown as`. Убрать после `npm run generate-types` с исправленным бэком.
  - **Серверный поиск по справочникам ЭКР пока не доделан.** Поэтому в главках поиск и фильтр по статусу оставлены на клиенте, а не унифицированы с внутренними кодами ЭКР. Это временно: когда бэк допилят, обе фичи переводим на серверный `search`. Не «чинить» это расхождение раньше времени.
  - Поиск в `/api/plan_items/` работает плохо; `ordering` не поддерживается; фильтр `purchase` отсутствует в схеме.
- `plan-items/detail`: `procurement.mock.ts` и `plan2` в `plan-item-detail.page.tsx` — временный костыль, вытеснять по мере готовности бэкенд-эндпоинтов для договоров/планирования/платежей.
- Есть параллельная реализация contract-section в `plan-items/create/form/contract-section/` — при подключении реального API для договоров в detail логику/схему (`quarter.schema.ts`, `helpers.ts`) стоит переиспользовать, а не писать заново.
