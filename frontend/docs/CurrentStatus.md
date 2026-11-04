# CurrentStatus.md — статус проекта для AI-агентов

> Служебный файл. Обновляй его при завершении крупных фич/сессий, чтобы не перечитывать весь проект заново.
> Дата последней актуализации: 2026-11-04, ветка `main`.

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
- Видимость колонок, сортировка, `actions(table)` для тулбара.

## Статус фич по разделам сайдбара

| Раздел (label в сайдбаре)         | Роут                      | Фича                              | Статус                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Годовые планы                      | `/plans`                  | `features/plans`                  | ✅ Реестр + (2026-11-04) кнопка «Синхронизировать с ЭТП» (`get_purchases_all`) и per-row синхронизация позиций плана (`get_purchases_items/{purchase_id}`), через `services/goszakupki`. CRUD/drawer плана не реализован (read-only реестр)                                                                                                                                                                                                                                                                         |
| Реестр закупок                    | `/plan-items`             | `features/plan-items/list`        | 🟡 Как раньше — серверная пагинация/поиск подключены, поиск на бэке работает плохо (баг бэка), `ordering` нет                                                                                                                                                                                                                                                                                                                                                                                                         |
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
  - Поиск в `/api/plan_items/` работает плохо; `ordering` не поддерживается; фильтр `purchase` отсутствует в схеме, но реально работает (ручной `get_queryset()`).
- **Новые хвосты бэка, обнаруженные в этой сессии (2026-11-04) при реализации разделов 2-6 `frontend_handoff.md`:**
  1. **Кастомные действия `ChangeRequestViewSet` (`submit/approve/reject/forecast/redistribute/calibrate_department_limits`) типизированы в OpenAPI как `ChangeRequest`** (и для тела запроса, и для ответа) — у них нет `serializer_class`, drf-spectacular подставляет сериализатор самого ViewSet. Реальные формы (прогноз по каждому из 5 `kind`, тело `reject`/`redistribute`/`calibrate`) заданы руками в `services/change-requests/types.ts` по тексту `frontend_handoff.md`, с `as unknown as ChangeRequest` на вызовах — рабочий, но хрупкий обход (если бэк поменяет форму прогноза без предупреждения, фронт не узнает об этом на этапе компиляции). Если у этих действий появится `serializer_class` → можно убрать весь файл `types.ts` и `as unknown as` касты, перейти на честные типы.
  2. **Нет read-эндпоинта для `BudgetQuarterlyLimit`** — ни списка, ни фильтра по `budget_cost`. Это заблокировало нормальный UX формы «Перераспределить лимит» (`features/change-requests/redistribution-form.tsx`): специалист должен **руками вводить числовые ID** `BudgetCosts`/`PlanShare` вместо выбора статьи/года/подразделения из комбобокса, потому что фронт не может показать текущие (старые) значения лимита по кварталам, чтобы предложить выбор. Нужно либо `GET /api/budget_quarterly_limit/?budget_cost=&quarter=`, либо достаточно расширить существующий поиск, чтобы можно было найти `BudgetCosts.id` по номеру позиции плана + году (сейчас `/api/budget_costs/` отдаёт только `plan_item` как ID, без `num`).
  3. **Нет справочника видов платежей** (`KindOfPayment`) отдельным GET-эндпоинтом — упомянуто самим бэкенд-агентом как известный гэп. Поле `kind` у платежа сейчас не выбирается в форме `features/payments/payment-form.tsx` (всегда `null` при создании). Специалист может позже выставить вид платежа через Swagger/админку.
  4. Отчёт «Назначено—обязательства—оплачено—остаток» строится как **плоская таблица**, без группировки по дереву подразделений/классификатора, которую предполагает `frontend_handoff.md` («таблица с разворачиваемыми группами»). Сознательное упрощение MVP ради скорости — дерево подразделений (`Department.parent`) и дерево классификатора (`InternalEconomicClassifier.parent`) уже загружаются в других фичах flattened, группировку можно добавить отдельной задачей, если понадобится.
- `plan-items/detail`: `procurement.mock.ts` остаётся временным источником данных для табов «Планирование»/«Договоры» — они всё ещё закомментированы в `plan-item-detail.page.tsx` (но теперь хотя бы проходят `tsc -b`, см. раздел про build выше). Подключать их по мере готовности бэкенд-эндпоинтов для договоров/планирования конкретно под карточку позиции плана (договоры теперь в принципе доступны через отдельный `/contracts`, но без фильтра "договоры этой позиции плана" — нужен отдельный проход).
- Есть параллельная реализация contract-section в `plan-items/create/form/contract-section/` — при подключении реального API для договоров в detail логику/схему (`quarter.schema.ts`, `helpers.ts`) стоит переиспользовать, а не писать заново.
- `features/plan-items/detail/tabs/info-tab/cost-department-drawer.tsx` — форма «Добавить подразделение» существует, но **её `onSubmit` ничего не отправляет на бэкенд** (`handleSubmit(close)` — просто закрывает Drawer). Это уже было так до этой сессии; теперь, когда `/api/plan_shares/` существует и правильный путь добавления `PlanShare` — через черновик `ChangeRequest` (см. таб «Заявка на изменение»), этот старый Drawer, вероятно, стоит либо удалить, либо тоже завести через `ChangeRequest` — решение пользователя.
