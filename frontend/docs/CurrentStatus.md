# CurrentStatus.md — статус проекта для AI-агентов

> Служебный файл. Обновляй его при завершении крупных фич/сессий, чтобы не перечитывать весь проект заново.
> Дата последней актуализации: 2026-08-03, ветка `feature/info-tab`, актуальный рефакторинг закупщиков — коммит `5d33742`.

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

| Раздел (label в сайдбаре)         | Роут                      | Фича                              | Статус                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------------- | ------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Годовые планы                     | `/plans`                  | `features/plans`                  | ✅ Готово. Таблица через `DataTable`, реальный API (`GET /api/purchases/`), клик по строке → переход в реестр закупок с фильтром по плану. CRUD/drawer не реализован (пока read-only реестр)                                                                                                                                                                                                                                                                                                                                                                          |
| Реестр закупок                    | `/plan-items`             | `features/plan-items/list`        | 🟡 Таблица, колонки с видимостью, реальный API. Серверная пагинация (`limit`/`offset` в URL, `manual` в `DataTable`) и серверный поиск (`search` + debounce 500мс) подключены 2026-07-12. **Хвосты:** поиск на бэке реализован плохо — переделать после доработки эндпоинта (`TODO` в `plans-items.page.tsx`); `ordering` на бэке нет, поэтому сортировка колонок не включена (клиентская сортировала бы только текущую страницу); query-параметр `purchase` фронт шлёт, но в OpenAPI-схеме `/api/plan_items/` его нет — проверить, не игнорит ли бэк фильтр по плану |
| Реестр закупок → карточка         | `/plan-items/:id`         | `features/plan-items/detail`      | 🟡 Частично. Таб «Информация» — реальный API (`plan-items/{id}/`). На время первоначальной загрузки показывается вынесенный компонент `PlanItemDetailSkeleton`. Триггеры табов «Планирование» и «Договоры» видимы, но их содержимое сейчас закомментировано; временные данные остаются в `procurement.mock.ts`. Таб «Платежи» — заглушка-текст, эндпоинт не подключён. Badge статуса включён, но в OpenAPI-типе `PlanItemFull` нет поля `status`, поэтому до уточнения контракта с бэкендом страница не проходит `tsc -b`.                                            |
| Реестр закупок → создание         | `/plan-items/add`         | `features/plan-items/create`      | 🟡 Форма готова визуально (табы: основная информация, планирование, договоры с quarter-table на 30 договоров через drawer), но `onSubmit` НЕ отправляет на бэкенд — просто `toast.info` + локальный state. Раздел договоров использует моки (`contracts.mock.ts`)                                                                                                                                                                                                                                                                                                     |
| ЭКР (экономическая классификация) | `/economic-code`          | `features/economic-code`          | ✅ Готово. Переписана 2026-07-12 по паттерну `code-okrb`: реальный API (`/api/economic_code/`, тип `EconomicCode` = `ExternalEconomicCode`), drawer CRUD, серверный поиск + серверный фильтр по `is_active`, сортировка. Справочник плоский — иерархии в API нет                                                                                                                                                                                                                                                                                                      |
| Внутренние коды ЭКР               | `/internal-economic-code` | `features/internal-economic-code` | ✅ Готово (2026-07-12). Реальный API (`/api/internal_economic_code/`), **древовидный** справочник: `sub_codes` → `getSubRows` в `DataTable`, авто-раскрытие групп при поиске (`forceExpanded`). Поиск серверный (debounce 500мс), фильтр по статусу — клиентский (`filterTreeByStatus`, рекурсивно, родитель остаётся если подошёл потомок). Drawer CRUD, выбор родителя из плоского списка (`flattenTree`). **Хвост:** каст `as unknown as InternalEconomicCode[]` — в сгенерированной схеме `sub_codes` пока `string`, убрать после доработки бэка                  |
| Коды ОКРБ                         | `/codes-okrb`             | `features/code-okrb`              | ✅ Готово. Переработано 2026-08-03 по целевому CRUD-паттерну: отдельные query/filter/create/update/delete-хуки в `model/`, форма без API-логики, drawer координирует мутации и блокирует закрытие во время запроса. Реальный API, серверные поиск и фильтр `is_active`, query keys и локальное состояние ошибки загрузки с повторным запросом                                                                                                                                                                                                                         |
| Главки                            | `/departments`            | `features/departments`            | ✅ Готово. **Древовидный** справочник (`sub_departments`), тот же паттерн, что и внутренние коды ЭКР. Отличие: поиск **клиентский** (`globalFilter` внутри tanstack-table), фильтр по статусу тоже клиентский. Так сделано намеренно, пока на бэке не допилят нормальный серверный поиск по справочникам — см. блок хвостов ниже. Тот же временный каст из-за `sub_departments: string` в схеме                                                                                                                                                                       |
| Закупщики                         | `/buyers`                 | `features/buyers`                 | 🟡 Реальный API и полный CRUD работают. Рефакторинг 2026-07-31: форма отделена от drawer, create/update/delete вынесены в отдельные хуки `model/`, добавлены query keys и инвалидация кеша, серверные поиск и фильтр статуса. Остались ошибки обработки загрузки и блокировки drawer во время мутации, а также хвосты валидации/API-контракта — см. отдельный раздел ниже                                                                                                                                                                                             |
| Поставщики                        | `/suppliers`              | `features/suppliers`              | ✅ Готово. Плоский справочник, тот же паттерн, реальный API                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Корректировка лимитов             | —                         | —                                 | ❌ Не реализовано, пункт в сайдбаре без роута (`url: "#"`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Авторизация                       | `/login`                  | `features/auth`                   | ✅ Есть login-форма и `ProtectedRoute` (bearer-токен из localStorage)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

## Закупщики (`features/buyers`) — состояние после рефакторинга 2026-07-31

- `buyers.page.tsx` отвечает за композицию таблицы, фильтров, drawer и локальное состояние выбранного закупщика.
- `buyer-drawer.tsx` отделён от формы: выбирает create/update по наличию `item`, показывает pending-состояние и передаёт в форму типизированный `onSubmit`.
- `buyer-form.tsx` содержит только React Hook Form + Zod и поля `shot_name`, `full_name`, `is_active`; API-мутаций и toast-логики в форме больше нет.
- Модель разнесена по отдельным хукам в `model/`:
  - `use-buyers.ts` — `GET /api/buyers/`;
  - `use-buyers-filters.ts` — локальные значения поиска/статуса, debounce поиска 500 мс и преобразование фильтра статуса в `is_active`;
  - `use-buyer-create.ts` — `POST /api/buyers/`;
  - `use-buyer-update.ts` — `PATCH /api/buyers/{id}/`;
  - `use-buyer-delete.ts` — `DELETE /api/buyers/{id}/` и определение удаляемой строки.
- Поиск и фильтр по активности выполняются на сервере через query-параметры `search` и `is_active`. Сортировка и пагинация остаются клиентскими внутри общего `DataTable`.
- Добавлен `buyer-keys.ts`; после create/update/delete все варианты списка инвалидируются префиксом `["get", "/api/buyers/"]`.
- Удаление использует общий confirm-dialog `DeleteButton`, перенесённый в `shared/components/ui/delete-button.tsx`; импорты справочников обновлены на новый путь.
- Toast-сообщения и закрытие drawer выполняются в mutation-хуках после успешного create/update; delete показывает отдельные success/error toast.

### Незакрытые ошибки `buyers`

- `model/use-buyers.ts`: проверка `query.error` помещена в `useMemo`, но `query.error` отсутствует в зависимостях. При первом неудачном запросе `query.data` остаётся `undefined`, memo не пересчитывается и таблица по-прежнему получает `[]`. Предпочтительный вариант — вернуть `isError`, `error`, `refetch` в страницу и показать локальное error-состояние; если нужен глобальный Error Boundary — использовать query option `throwOnError: true`.
- `buyer-drawer.tsx`: во время мутации заблокированы только кнопки. Vaul остаётся dismissible через Escape, overlay и свайп; старый `onSuccess` может закрыть drawer, открытый для другой записи. Нужно считать `isPending` через create/update с `||`, передать `dismissible={!isPending}`, защитить `onOpenChange` и убрать дублирующий `onClick={onClose}` у `DrawerClose`.
- `buyer.schema.ts`: обязательные строки используют только `.min(1)` и пропускают значения из пробелов; добавить `.trim().min(1, ...)`.
- `buyer-form.tsx`: `...item` добавляет `id` во внутренние значения React Hook Form, поэтому read-only поле фактически попадает в PATCH. Формировать значения формы явно только из редактируемых полей.
- `model/use-buyer-create.ts`: POST отправляет фиктивный `id: 0`, потому что текущая OpenAPI request-схема повторно использует response-модель `Buyer` с обязательным `readonly id`. Исправить request-схему на бэкенде и после регенерации перестать отправлять `id`.
- Иконка редактирования и элементы фильтра/статуса требуют доступных подписей (`aria-label`, связанный `label`/`id`).

## Общий CRUD-паттерн справочников

Справочники используют общий базовый подход. После рефакторинга `buyers` целевой вариант для новых и постепенно обновляемых плоских справочников выглядит так:

- `<name>.page.tsx` — `Card` + `DataTable` + `drawerOpen`/`editingItem` state
- `<name>-toolbar.tsx` + `<name>-filter.tsx` — поиск и фильтр по статусу (`StatusFilterValue`)
- `<name>-drawer.tsx` — оболочка Drawer, выбор create/update и pending-состояние
- `<name>-form.tsx` (или `form/<name>-form.tsx`) — UI формы без API-мутаций
- `<name>.schema.ts` — Zod-схема
- `columns.tsx` — фабрика `createColumns(handleEdit, handleDelete, deletingId)`
- `model/use-<name>.ts` — query; отдельные хуки для фильтров и create/update/delete; query keys — рядом с фичей. При следующем рефакторинге не создавать общий каталог `hooks/`, так как он запрещён правилами `docs/architecture.md`

Для древовидных справочников (главки, внутренние ЭКР) в хуке дополнительно живут `flattenTree` (плоский список для выбора родителя в форме) и `filterTreeByStatus` (рекурсивный фильтр по статусу).

## Что нужно знать перед следующей задачей

- **Незакрытые хвосты бэка**, из-за которых стоят касты и `TODO`:
  - POST `/api/okrb/` использует response-модель `OkrbProduct` с обязательным `readonly id` как request-схему → `use-code-okrb-create.ts` временно отправляет `id: 0`. Исправить request-схему на бэкенде, регенерировать типы и удалить костыль.
  - `sub_codes` / `sub_departments` в OpenAPI-схеме типизированы как `string`, а приходит массив узлов → в `use-internal-economic-code.ts` и `use-departments.ts` стоит `as unknown as`. Убрать после `npm run generate-types` с исправленным бэком.
  - `cost_departments` в `BudgetCostsForItem` также пока описан в OpenAPI как `string`, хотя `GET /api/plan_items/{id}/` возвращает массив распределений с `department_detail`, `shared_amount`, `total_shared_cost` и разбивкой суммы по источникам. В `shared/api/schema/index.ts` временно задан фактический тип `CostDepartment`.
  - **Серверный поиск по справочникам ЭКР пока не доделан.** Поэтому в главках поиск и фильтр по статусу оставлены на клиенте, а не унифицированы с внутренними кодами ЭКР. Это временно: когда бэк допилят, обе фичи переводим на серверный `search`. Не «чинить» это расхождение раньше времени.
  - Поиск в `/api/plan_items/` работает плохо; `ordering` не поддерживается; фильтр `purchase` отсутствует в схеме.
- `plan-items/detail`: `procurement.mock.ts` остаётся временным источником данных; содержимое табов «Планирование» и «Договоры» в `plan-item-detail.page.tsx` сейчас закомментировано. Подключать их по мере готовности бэкенд-эндпоинтов для договоров и планирования. Для Badge статуса нужно согласовать поле с бэкендом и регенерировать OpenAPI-типы.
- Есть параллельная реализация contract-section в `plan-items/create/form/contract-section/` — при подключении реального API для договоров в detail логику/схему (`quarter.schema.ts`, `helpers.ts`) стоит переиспользовать, а не писать заново.
