# CurrentStatus.md — статус проекта для AI-агентов

> Служебный файл. Обновляй его при завершении крупных фич/сессий, чтобы не перечитывать весь проект заново.
> Дата последней актуализации: 2026-11-06, ветка `main`.

> ⚠️ Перед работой также прочитай `../../doc/frontend_handoff.md` — инструкция от backend-агента
> о том, что реализовано на бэке (Этапы 2-9) и что нужно построить на фронте под это.
> Статус ниже — после реализации разделов 1-6 этого документа почти целиком (см. таблицу).

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
  services/      # НОВОЕ (2026-11-04) — переиспользуемая бизнес-логика между фичами
    change-requests/  # движок заявок (ChangeRequest): api.ts, model.ts, types.ts, ui/
    reports/           # /api/reports/* — обёртка над authorizedFetch (см. ниже)
    goszakupki/        # /api/gosakupki/*, /api/goszakupki/* — тоже authorizedFetch
  shared/
    api/         # instance.ts (rqClient), query-client.ts, schema/ (генерируется)
    components/
      data-table/  # общий DataTable на tanstack-table
      form/
      ui/          # shadcn-компоненты
      section-card.tsx  # перенесён из features/plan-items — переиспользуется 2+ фичами
    lib/helpers/, lib/react/
      authorized-fetch.ts  # НОВОЕ — fetch с Bearer-токеном для эндпоинтов без OpenAPI-схемы
    model/routes.ts   # ROUTES + типизация path-параметров
    model/status.ts   # StatusFilterValue ("all" | "true" | "false")
```

Эволюция архитектуры: `services/` создан впервые в этой сессии (до этого — пустая папка-заготовка
из `docs/architecture.md`). Правило импортов для него совпадает с `shared`: `services → только из
services и shared`; `features → из services и shared`. Добавлено в `eslint.boundaries.js`
(элемент `services`, `pattern: "./src/services/*"`, entry-point требует `index.ts`).

## ⚠️ Важная находка: `npm run type-check` не проверяет реальный код

`tsc --noEmit` (без `-b`) запускается против корневого `tsconfig.json`, у которого `"files": []` и
нет `include` — в этом режиме TS **не следует project references** и проверяет буквально ноль
файлов. Поэтому `npm run type-check` **всегда возвращает успех**, даже если в `tsconfig.app.json`
(реальный код приложения) есть ошибки. Реальную проверку делает только `npm run build`
(`tsc -b && vite build`), которая использует project references и действительно обходит всё дерево.
**Решение пока не принято** — чинить сам скрипт `type-check` (например, на `tsc -b --noEmit`) не
стал без отдельного запроса, т.к. это меняет поведение CI/lint-staged для всех.

**2026-11-04: найдено и исправлено 13 pre-existing ошибок `npm run build`**, не связанных с
задачами сессии (обнаружены случайно, при итоговой проверке сборки после Этапов 1-6 ниже) — не
регрессия от этой сессии, но раз уж `npm run build` до этого не проходил вовсе, пользователь
попросил починить сразу:
- `features/departments/hooks/use-department-form.ts` — `sub_departments` readonly-поле требовалось и при создании (drf-spectacular не умеет помечать рекурсивные readonly optional) → добавлена заглушка `sub_departments: ""`.
- `features/internal-economic-code/hooks/use-internal-economic-code-form.ts` — тип `InternalEconomicCodeBody` был ошибочно построен на прикладном (display) алиасе `InternalEconomicCode` (где `sub_codes` — массив узлов), а не на «сыром» generated-типе для записи → переведён на `ApiSchemas["InternalEconomicClassifierTree"]`, PATCH больше не требует каста вообще.
- `features/plan-items/create/form/base-info-another-section.tsx` — `as DepartmentNode[]` без промежуточного `unknown` → `as unknown as DepartmentNode[]`.
- `features/plan-items/detail/plan-item-detail.page.tsx` — Badge статуса в хедере карточки позиции читал несуществующее поле `plan.status` (всегда рисовал «Черновик», реальных данных там никогда не было) → Badge удалён целиком вместе с неиспользуемыми импортами, а не подменён фиктивным значением.
- `features/plan-items/detail/procurement.mock.ts` — импортировал несуществующий `PlanStatus` из `plan-meta.ts` → заменён на уже существующий `StatusEnum` из `shared/api/schema`.
- `features/plan-items/detail/tabs/contracts-tab.tsx` — мок-данные (`FinancingDepartment[]`) передавались в компонент, рассчитанный на реальный API (`CostDepartment[]`) → явный `as unknown as CostDepartment[]` с комментарием, что таб целиком на моках и не подключён.
- `features/suppliers/supplier-form.tsx`, `features/suppliers/use-suppliers.ts` — `Supplier.unp` стал `string | null` в схеме, код ожидал всегда `string` → нормализация `?? ""`/`?? false`.
- `shared/api/crud-service.ts` — **удалён**: мёртвый файл (0 импортов по всему `src/`), зависел от `axios`, которого нет и не должно быть в зависимостях (проект стандартизирован на `openapi-fetch`, см. `AGENTS.md`).
- `shared/components/ui/calendar.tsx` — ключ `table` в `classNames` переименован в `react-day-picker` v10 → `month_grid`.

Все 13 — в файлах, не редактировавшихся в рамках Этапов 1-6 этой сессии (проверено по `git diff`
перед правкой). `npm run build` теперь проходит полностью, финальный бандл собирается.

## Общий `DataTable` (`shared/components/data-table/data-table.tsx`)

Один компонент покрывает все таблицы проекта. Что умеет (все режимы опциональны):

- **Серверная пагинация** — проп `pagination.manual` (`pageIndex`/`pageSize`/`rowCount`/`onChange`). Без него — клиентская.
- **Древовидные строки** — `getSubRows` (включает `getExpandedRowModel`, `paginateExpandedRows: false`, `filterFromLeafRows: true`) + `forceExpanded` для авто-раскрытия групп во время поиска.
- **Поиск** — внешний `globalFilter` (клиентская фильтрация) либо `manualFiltering` для серверного.
- **Колоночные фильтры** (НОВОЕ 2026-11-06) — внешние `columnFilters`/`onColumnFiltersChange` (тот же паттерн, что и `globalFilter`/`onGlobalFilterChange`: без них живут во внутреннем стейте таблицы). Нужны, когда значения фильтров должны уйти наружу компонента — например, в query-параметры серверного запроса (см. `plans-items.page.tsx` + `registry-filters.tsx`, где фильтр пишет/читает через `table.getColumn(id).setFilterValue()`, а реальное значение для запроса берёт родительская страница из своего же лифтованного стейта). `DataTable` сам их не "видит" особым образом — обычный `columnFilters`-стейт `tanstack-table`, просто управляемый снаружи, как и `manualFiltering`, который по-прежнему нужен отдельно, если фактическая фильтрация строк делается не в браузере.
- Видимость колонок, сортировка, `actions(table)` для тулбара. `meta.label` в `columns.tsx` — текстовая подпись колонки для меню "Вид колонок" (там `header` часто JSX, не строка).
- **`fillAvailableHeight`** (НОВОЕ 2026-11-05) — таблица растягивается на всю доступную высоту родителя (`flex-1`/`min-h-0`) вместо фиксированного `max-h-[85vh]`. Раньше фиксированный `max-h` не учитывал высоту чужого контента над/под таблицей на конкретной странице — горизонтальный скроллбар и пагинация могли уезжать за пределы видимой области экрана. Включено на всех страницах-списках верхнего уровня (не на вложенных таблицах в табах/формах — там нет подходящего родителя-флекса). Требует, чтобы родительская цепочка была flex-колонкой с `min-h-0` до самого `<main>` — см. `app/main-layout.tsx` (`SidebarInset` зафиксирован на `h-svh`, скролл обычных страниц — на `<main>` через `overflow-y-auto`, а не на `body`).
- **`persistenceKey`** (НОВОЕ 2026-11-05) — видимость колонок сохраняется в `localStorage` (`shared/lib/react/use-local-storage-state.ts`) и переживает переход на другую страницу и обратно. Без ключа — обычный `useState`, не персистится. Используется пока только на `/plan-items` (`persistenceKey="plan-items-list"`) — там же выбранный год (`YearToggle`) отдельно персистится тем же хуком напрямую в `plans-items.page.tsx` (приоритет: URL-параметр `?purchase=` → сохранённое значение → самый актуальный год).

## Статус фич по разделам сайдбара

| Раздел (label в сайдбаре)         | Роут                      | Фича                              | Статус                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Годовые планы                      | `/plans`                  | `features/plans`                  | ✅ Реестр + (2026-11-04) кнопка «Синхронизировать с ЭТП» (`get_purchases_all`) и per-row синхронизация позиций плана (`get_purchases_items/{purchase_id}`), через `services/goszakupki`. CRUD/drawer плана не реализован (read-only реестр)                                                                                                                                                                                                                                                                         |
| Реестр закупок                    | `/plan-items`             | `features/plan-items/list`        | ✅ **(2026-11-06) Фильтры по столбцам** (функц./эконом./внутренний ЭКР код) — 3 комбобокса в тулбаре (`registry-filters.tsx`). Бэкенд добавил серверную поддержку, страница **серверная целиком**: `useServerPagination`/`useServerSearch` + значения фильтров (`columnFilters`, поднятые из `DataTable` на уровень страницы, см. раздел про `DataTable` ниже) уходят как query-параметры `functional_code`/`economic_code`/`internal_economic_code` (как и `purchase` раньше — отсутствуют в OpenAPI-схеме, но реально работают). Опции комбобоксов берутся из справочников `/api/functional_code/`, `/api/economic_code/` (плоские, бэк почистил дубли-форматы 2026-11-06), `/api/internal_economic_code/` (дерево, листья разворачиваются в плоский список в `registry-filters.tsx`) — НЕ из загруженных данных реестра, т.к. страница больше не грузит весь год. Сумма под таблицей (`registry-money-summary.tsx`) — отдельный запрос с большим `limit` и теми же фильтрами, без `placeholderData` (специально показывает «считается…» на время запроса, не блокирует отрисовку списка) — см. следующую строку про производительность |
| Реестр закупок → карточка         | `/plan-items/:id`         | `features/plan-items/detail`      | 🟡 Таб «Информация» на реальном API (Badge статуса в хедере карточки удалён — поле `status` не существует на `PlanItemFull`, см. раздел про `npm run build`). Таб «Платежи» всё ещё заглушка (общий реестр платежей теперь есть на `/payments`, но без фильтра по позиции плана — не связано). Табы «Планирование»/«Договоры» остаются закомментированы (мок). **НОВОЕ (2026-11-04): таб «Заявка на изменение»** — кнопки «Изменить»/«Исключить», создание `ChangeRequest`, инлайн-редактор черновика (`PlanItemDetail`/`BudgetCosts`/`PlanShare`), прогноз, submit/approve/reject, отправка на goszakupki.by после одобрения. См. `tabs/change-request-tab/` |
| Реестр закупок → создание         | `/plan-items/add`         | `features/plan-items/create`      | 🟡 Без изменений — форма не отправляет на бэкенд                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Заявки на изменение**           | `/change-requests`        | `features/change-requests`        | ✅ **НОВОЕ (2026-11-04).** Общий список `ChangeRequest` (все 5 `kind`), фильтры статус/вид, серверная пагинация. Drawer с деталями: обоснование, прогноз (своя таблица под каждый `kind`), submit/approve/reject. Кнопка «Перераспределить лимит» (создание `LIMIT_REDISTRIBUTION` — форма с ID-полями `BudgetCosts`/`PlanShare`, т.к. у бэка нет read-эндпоинта для подбора — см. открытые хвосты). `BUDGET_LIMIT_CORRECTION` отображается/одобряется в общем списке (создаётся на бэке)                      |
| **Договоры**                      | `/contracts`              | `features/contracts`              | ✅ **НОВОЕ.** Реестр (номер/дата/контрагент/сумма/просрочка), Drawer-карточка со спецификацией (`ContractItem[]`) и редактируемым квартальным планом (`planned_cost`, `actual_cost` read-only) через `/api/contract_quarterly_finance/`                                                                                                                                                                                                                                                                             |
| **Платежи**                       | `/payments`                | `features/payments`               | ✅ **НОВОЕ.** CRUD, переключатель «по договору»/«свободный платёж» (справочник подразделений + статьи ЭКР/функц. классификации для свободных). Фильтр по кварталу. **Вид платежа (`kind`) не выбирается в UI** — у бэка нет отдельного GET-эндпоинта списка `KindOfPayment` (см. открытые хвосты), поле остаётся `null` при создании                                                                                                                                                                              |
| **Отчёты**                        | `/reports`                 | `features/reports`                | ✅ **НОВОЕ.** Два таба: «Общие деньги» (`/api/reports/general_money/`, фильтр год) и «Назначено—обязательства—оплачено—остаток» (`/api/reports/budget_execution/`, фильтры год/подразделение/квартал). Таблицы **плоские**, без вложенной иерархии подразделений/классификатора (упрощение MVP — см. открытые хвосты)                                                                                                                                                                                              |
| ЭКР (экономическая классификация) | `/economic-code`          | `features/economic-code`          | ✅ Без изменений                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Внутренние коды ЭКР               | `/internal-economic-code` | `features/internal-economic-code` | ✅ Без изменений (попутно починен `sub_codes`-баг в write-типе формы — см. раздел про build выше)                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Коды ОКРБ                         | `/codes-okrb`              | `features/code-okrb`              | ✅ Без изменений                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Главки                            | `/departments`             | `features/departments`            | ✅ Без изменений (попутно починена заглушка `sub_departments` в create-запросе — см. раздел про build выше)                                                                                                                                                                                                                                                                                                                                                                                                           |
| Закупщики                         | `/buyers`                   | `features/buyers`                 | ✅ Без изменений                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Поставщики                        | `/suppliers`                | `features/suppliers`              | ✅ Без изменений (попутно починена `unp`-нормализация — см. раздел про build выше)                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Корректировка лимитов**         | `/limit-calibration`        | `features/limit-calibration`      | ✅ **НОВОЕ.** Было заглушкой (`url: "#"`). Форма «Начать калибровку» (функц.+эконом. классификация+год → `calibrate_department_limits`), список существующих калибровок, редактор подстатей/держателей (`DepartmentArticleLimit`, два уровня), живая сверка через общий прогноз. **Edge-case:** при возврате к пустому черновику (0 строк) после обновления страницы контекст статьи/года теряется — показывается подсказка пересоздать калибровку (см. открытые хвосты)                                        |
| Авторизация                       | `/login`                    | `features/auth`                   | ✅ Без изменений                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Общий CRUD-паттерн справочников

Все справочники (ЭКР, внутренние ЭКР, ОКРБ, главки, закупщики, поставщики) сделаны одинаково — если добавляется новый, копировать этот паттерн:

- `<name>.page.tsx` — `Card` + `DataTable` + `drawerOpen`/`editingItem` state
- `<name>-toolbar.tsx` + `<name>-filter.tsx` — поиск и фильтр по статусу (`StatusFilterValue`)
- `<name>-form.tsx` (или `form/<name>-form.tsx`) — форма в Drawer (create/update)
- `<name>.schema.ts` — Zod-схема
- `columns.tsx` — фабрика `createColumns(handleEdit, handleDelete, deletingId)`
- `hooks/use-<name>.ts` — query + поиск + фильтр + `invalidate`; `hooks/use-<name>-delete.ts` — удаление через confirm-dialog

Для древовидных справочников (главки, внутренние ЭКР) в хуке дополнительно живут `flattenTree` (плоский список для выбора родителя в форме) и `filterTreeByStatus` (рекурсивный фильтр по статусу).

**Паттерн «заявка на изменение» (`services/change-requests`), добавлен 2026-11-04** — переиспользуется
в `features/change-requests` (общий список), `features/plan-items/detail` (кнопки «Изменить»/«Исключить»
на карточке позиции), `features/limit-calibration` (калибровка лимитов). Ядро: `ChangeRequestActions`
(status-badge + обоснование + прогноз по `kind` + submit/approve/reject + отправка на goszakupki.by) —
UI-компонент, принимающий `ChangeRequest`, ничего не знающий о конкретной фиче-потребителе. Если
добавляется 6-й сценарий `ChangeRequest` — расширять `services/change-requests/types.ts` (форма
прогноза) и `ui/forecast-view.tsx` (рендер), остальное переиспользуется как есть.

**Паттерн «эндпоинт без OpenAPI-схемы» (`shared/lib/helpers/authorized-fetch.ts`)** — для
`/api/reports/*`, `/api/gosakupki/*`, `/api/goszakupki/*` (plain `APIView` без `serializer_class` —
drf-spectacular не генерирует ни параметров, ни формы ответа, см. `frontend_handoff.md` раздел 8).
`rqClient`/`openapi-fetch` для них бесполезен — типы вручную заданы в `services/reports/types.ts` и
`services/goszakupki/types.ts` по тексту бэкенд-агента, запрос идёт через `authorizedFetch<T>(path)`
(обычный `fetch` + Bearer-токен из `localStorage`). Если бэк добавит `serializer_class` этим эндпоинтам
и перегенерируются типы — можно будет перевести на `rqClient`, но тогда уже не будет большого смысла.

## Что нужно знать перед следующей задачей

- **`npm run type-check` не проверяет реальный код приложения** (см. раздел выше) — не доверять его
  "успеху" слепо, либо всегда дополнительно гонять `npm run build` перед тем, как считать задачу
  готовой, либо попросить пользователя/бэкенд поправить корневой `tsconfig.json` (добавить `include`
  или перейти на `tsc -b --noEmit` в скрипте `type-check`). Решение не принято — нужно спросить
  пользователя, т.к. включение реальной проверки сразу "взрывает" 13 pre-existing ошибок (см. выше).
- **Незакрытые хвосты бэка**, из-за которых стоят касты и `TODO` (без изменений с прошлой сессии):
  - `sub_codes` / `sub_departments` в OpenAPI-схеме типизированы как `string`, а приходит массив узлов → касты `as unknown as` в нескольких местах (`use-departments.ts`, `use-internal-economic-code.ts`, и теперь также в `department-article-limits-editor.tsx`, `payment-form.tsx`, `budget-execution-tab.tsx` — везде, где нужен флоттед список подразделений/внутренних кодов). Эти касты уже стали нормой в проекте, а не временным хаком — если бэк когда-нибудь исправит схему, искать по `TODO: убрать приведение после исправления`.
  - **Серверный поиск по справочникам ЭКР пока не доделан** — как раньше.
  - ~~Поиск в `/api/plan_items/` работает плохо~~ — **починено 2026-11-05**, см. таблицу фич выше.
    `ordering` всё ещё не поддерживается; фильтр `purchase` отсутствует в схеме, но реально работает
    (ручной `get_queryset()`).
  - ~~Нужна серверная фильтрация `/api/plan_items/` по `functional_code`/`economic_code`/
    `internal_economic_code`~~ — **бэк добавил 2026-11-06**, все три параметра реально сужают `count`.
  - ~~Производительность `/api/plan_items/` — блокер для серверной фильтрации~~ — **бэк ускорил
    2026-11-06.** Было: полная выгрузка года (`limit=10000`) ~9с, маленькая страница (`limit=20`)
    ~2.3с (не зависело от объёма — фиксированные накладные расходы). Стало: маленькие/"тёплые" запросы
    — **60-80мс**; большие (сотни-тысячи строк) — по-прежнему стабильно **~2-2.3с**, не ускоряется
    повторными вызовами (это, похоже, неизбежные расходы на сериализацию/передачу большого JSON, а не
    то, что можно "прогреть"). Поэтому страница реестра переведена на серверную пагинацию/поиск/фильтры
    (быстро), а сумма под таблицей — на отдельный запрос с большим `limit` без `placeholderData`
    (показывает "считается..." на ~2с при каждом изменении фильтра/поиска/года — осознанный компромисс,
    выбран пользователем вместо и клиентской фильтрации, и ожидания доп. ускорения бэка).
  - ~~Справочники `/api/functional_code/`/`/api/economic_code/` содержат дублирующиеся коды в разных
    форматах~~ — **бэк почистил 2026-11-06** (было 29 записей с дублями `"03 12 00 039"` +
    `"3 12 0 039"`, стало 16 чистых). Дерево `/api/internal_economic_code/` тоже починено — `sub_codes`
    теперь всегда массив (раньше у части листьев был мусорный паддинг-строкой, хотя в OpenAPI-схеме
    всё ещё типизирован как `string` — `registry-filters.tsx` бережно кастует `as unknown as` и
    проверяет `Array.isArray` перед использованием). Опции для всех трёх комбобоксов-фильтров теперь
    берутся из этих справочников (не из загруженных данных реестра — страница их больше не грузит
    целиком).
- **Хвосты бэка, обнаруженные в сессии 2026-11-04 при реализации разделов 2-6 `frontend_handoff.md`:**
  1. ~~Кастомные действия `ChangeRequestViewSet` типизированы в OpenAPI как `ChangeRequest`~~ —
     **починено бэком и подтянуто на фронт 2026-11-05.** `forecast`/`submit`/`approve`/`reject`/
     `redistribute`/`calibrate_department_limits` теперь честно типизированы
     (`@extend_schema`/`PolymorphicProxySerializer`). `as unknown as ChangeRequest(Forecast)` убраны
     из `services/change-requests/api.ts`, типы в `types.ts` теперь алиасы на `ApiSchemas`, а не
     ручные копии формы. Денежные поля прогноза — `string` (DRF `Format: decimal`), не `number` —
     учтено в `forecast-view.tsx`. Единственный оставшийся каст — `useCreateChangeRequest`
     (`POST /api/change_requests/`, это базовый `ModelViewSet.create()`, не кастомный `@action`,
     под него схему не чинили).
  2. **`GET /api/budget_quarterly_limit/` теперь существует** (бэк добавил 2026-11-05), но **в UI
     ещё не подключён** — форма «Перераспределить лимит» (`features/change-requests/redistribution-form.tsx`)
     всё ещё требует руками вводить числовые ID `BudgetCosts`/`PlanShare`. Задача на подключение
     открыта (заменить текстовые поля на комбобокс по этому эндпоинту).
  3. **`GET /api/kind_of_payment/` теперь существует** (бэк добавил 2026-11-05), но **в UI ещё не
     подключён** — поле `kind` в форме платежа (`features/payments/payment-form.tsx`) всё ещё
     всегда `null` при создании. Задача на подключение открыта.
  4. Отчёт «Назначено—обязательства—оплачено—остаток» строится как **плоская таблица**, без группировки по дереву подразделений/классификатора, которую предполагает `frontend_handoff.md` («таблица с разворачиваемыми группами»). Сознательное упрощение MVP ради скорости — дерево подразделений (`Department.parent`) и дерево классификатора (`InternalEconomicClassifier.parent`) уже загружаются в других фичах flattened, группировку можно добавить отдельной задачей, если понадобится.
- `plan-items/detail`: `procurement.mock.ts` остаётся временным источником данных для табов «Планирование»/«Договоры» — они всё ещё закомментированы в `plan-item-detail.page.tsx` (но теперь хотя бы проходят `tsc -b`, см. раздел про build выше). Подключать их по мере готовности бэкенд-эндпоинтов для договоров/планирования конкретно под карточку позиции плана (договоры теперь в принципе доступны через отдельный `/contracts`, но без фильтра "договоры этой позиции плана" — нужен отдельный проход).
- Есть параллельная реализация contract-section в `plan-items/create/form/contract-section/` — при подключении реального API для договоров в detail логику/схему (`quarter.schema.ts`, `helpers.ts`) стоит переиспользовать, а не писать заново.
- `features/plan-items/detail/tabs/info-tab/cost-department-drawer.tsx` — форма «Добавить подразделение» существует, но **её `onSubmit` ничего не отправляет на бэкенд** (`handleSubmit(close)` — просто закрывает Drawer). Это уже было так до этой сессии; теперь, когда `/api/plan_shares/` существует и правильный путь добавления `PlanShare` — через черновик `ChangeRequest` (см. таб «Заявка на изменение»), этот старый Drawer, вероятно, стоит либо удалить, либо тоже завести через `ChangeRequest` — решение пользователя.
