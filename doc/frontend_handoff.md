# Backend → Frontend: что реализовано и что нужно построить

> Автор — backend-агент (Claude Code), для агента frontend-разработчика (другой Claude Code,
> работающий в `frontend/`). Этот файл лежит ВНЕ `frontend/` (в `doc/`), т.к. backend-агенту
> запрещено писать внутрь `frontend/`. Скопируйте нужные разделы себе в `docs/` или читайте
> отсюда напрямую.
>
> Дата: 2026-11-03. Актуальность: сверено с реальным кодом backend на эту дату, не с памятью.

> **Обновление 2026-11-05.** Все 3 дырки, найденные фронтом при реализации разделов 2-9
> (`frontend/docs/CurrentStatus.md`, "Новые хвосты бэка, обнаруженные ... 2026-11-04"),
> закрыты:
> 1. У кастомных actions `ChangeRequestViewSet` теперь честная OpenAPI-схема — `forecast`
>    отдаёт `PolymorphicProxySerializer` (`oneOf`+`discriminator` по `kind`, 5 вариантов),
>    `reject`/`redistribute`/`calibrate_department_limits` — правильные request-схемы.
>    Ответ `forecast` теперь содержит поле `kind` (дискриминатор) — перегенерируйте типы.
> 2. Новый `GET /api/budget_quarterly_limit/` (фильтры `status`/`budget_cost`/
>    `budget_cost__year`/`plan_share`/`quarter`) + `/api/budget_costs/` теперь поддерживает
>    `?search=<номер позиции плана>` и отдаёт `plan_item_num`.
> 3. Новый `GET /api/kind_of_payment/` — справочник видов платежей для формы платежа.
>
> После `npm run generate-types` поищите `as unknown as ChangeRequest` на вызовах `forecast`
> в `services/change-requests/` — теперь должны быть honest-типы без каста.

## 0. Как пользоваться этим документом

1. Backend запущен на `localhost:8000` (или свой dev-порт) — обязательно перед `npm run generate-types`.
2. Swagger — `/api/schema/swagger-ui/`. Если что-то в этом документе разойдётся с реальной схемой — **верьте схеме**, не этому файлу (он может устареть).
3. Все эндпоинты сейчас `AllowAny` — авторизация осознанно отложена (Этап 7), токен можно не слать.
4. После любого изменения на backend, которое касается API — обязательно `npm run generate-types`.
5. Это не одна фича, а **девять этапов backend-работы**, часть из которых на фронте не отражена вообще, часть — на моках. Ниже — по каждому: что это, какие эндпоинты, какие бизнес-правила, что нужно построить.

**Договорённость с пользователем (2026-11-03): следующий backend-отчёт НЕ начинается, пока не будет готов и проверен фронт для отчёта «Общие деньги»+калибровки (раздел 7) И для всего, что реализовано раньше (разделы 1-6).** Поэтому ниже всё расписано, а не только последнее.

---

## 1. Общая картина процесса (зачем всё это)

Коротко контекст из ТЗ, чтобы было понятно, зачем нужны статусы и заявки, а не просто CRUD:

- Специалист-закупщик ведёт годовой план закупок (ГПЗ). Часть позиций публикуется на внешнем портале `goszakupki.by`, часть — нет.
- Любое изменение/исключение позиции плана — это не прямой `PATCH`, а **заявка на изменение** (`ChangeRequest`): черновик → проверка финансистом → одобрение/отклонение. Финансист должен увидеть прогноз последствий (не превышены ли лимиты) ДО одобрения.
- Казначейство выделяет деньги по статьям ЭКР (укрупнённо, на всю организацию). Внутри организации эти деньги режутся на подстатьи и далее — на подразделения (держатели лимита). Это тоже заявки с проверкой.
- Договоры и платежи — отдельный контур, но считаются по тем же статьям/подразделениям для отчётности.

---

## 2. Движок одобрения изменений (`ChangeRequest`) — фронта нет вообще

### Модель
```
GET/POST /api/change_requests/   (фильтры: status, kind, plan_item)
```
Поля (`ChangeRequestSerializer`): `id, plan_item, plan_item_num, kind, kind_display, status, status_display, reason, rejection_reason, submitted_at, reviewed_at, created_at, changed_at`.

`kind` (`ChangeRequestKind`): `PLAN_ITEM_CHANGE`, `PLAN_ITEM_EXCLUSION`, `LIMIT_REDISTRIBUTION`, `BUDGET_LIMIT_CORRECTION`, `DEPARTMENT_LIMIT_CALIBRATION`.
`status` (`ChangeRequestStatus`): `DRAFT → ON_REVIEW → APPROVED | REJECTED`.

### Действия (одинаковые для ЛЮБОГО kind)
```
POST /api/change_requests/{id}/submit/    — DRAFT → ON_REVIEW
POST /api/change_requests/{id}/approve/   — ON_REVIEW → APPROVED (может вернуть 400, см. ниже)
POST /api/change_requests/{id}/reject/    — body: {rejection_reason}
GET  /api/change_requests/{id}/forecast/  — прогноз последствий, read-only, формат зависит от kind (см. ниже)
```
`approve()` может вернуть `{"detail": "..."}` с 400 — **всегда показывать текст ошибки пользователю**, это не баг, а бизнес-отказ (например, превышение лимита, перерасход калибровки).

### 2.1. Изменение/исключение позиции плана (`PLAN_ITEM_CHANGE` / `PLAN_ITEM_EXCLUSION`)

Создание — **не через `POST /api/change_requests/`** напрямую (он требует `kind`+`plan_item`+`reason`, но для этих двух `kind` подходит прямой `POST`):
```
POST /api/change_requests/   body: {plan_item: <id>, kind: "PLAN_ITEM_CHANGE"|"PLAN_ITEM_EXCLUSION", reason: "..."}
```
- Для `PLAN_ITEM_EXCLUSION` — `reason` **обязателен** (400 без него), заявка сразу уходит в `ON_REVIEW` (без черновика — нечего редактировать).
- Для `PLAN_ITEM_CHANGE` — backend клонирует текущие ACTIVE `PlanItemDetail`/`BudgetCosts`(все года)/`PlanShare` в статус `DRAFT`, привязывая к `change_request`. Заявка создаётся в статусе `DRAFT`.

**Нужно построить:** на карточке позиции плана — кнопки «Изменить» и «Исключить». «Изменить» → после создания заявки найти и показать её черновик для редактирования:
```
GET /api/plan_items_details/?change_request=<id>&status=DRAFT   — черновик детальной информации (title, val_amount, fund_cost, inner_cost и т.д.) — PATCH для правки
GET /api/budget_costs/?change_request=<id>&status=DRAFT         — черновики годового финансирования по годам — PATCH для правки суммы (cost)
GET /api/plan_shares/?change_request=<id>&status=DRAFT          — черновики распределения по подразделениям — PATCH для правки department/shared_cost
```
> ⚠️ `GET /api/plan_shares/` и фильтрация черновиков по `change_request` на `budget_costs`/`plan_items_details` **появились только сегодня** (2026-11-03) — до этого такого эндпоинта/фильтра не было вовсе, редактировать черновик было физически нечем. Если увидите старую версию схемы без этого — перегенерируйте типы.

После правок — кнопка «Отправить на проверку» → `submit`, затем у финансиста — «Прогноз» → `forecast`, затем «Одобрить»/«Отклонить».

**Форма прогноза для `PLAN_ITEM_CHANGE`** (`GET .../forecast/`):
```json
{
  "by_article": [{"year": 2026, "economic_code": "1 10 10 99", "new_allocated": 500000, "committed_obligations": 450000, "is_over_budget": false, "shortfall": 0}],
  "by_department": [{"department": "ГУФиТ", "year": 2026, "new_allocated": 300000, "committed_obligations": 280000, "is_over_budget": false, "shortfall": 0}]
}
```
`is_over_budget: true` — подсветить красным: новая сумма меньше уже принятых обязательств (уже заключённых договоров).

**Форма прогноза для `PLAN_ITEM_EXCLUSION`**:
```json
{"by_department": [{"department": "...", "year": 2026, "allocated": 300000, "committed_obligations": 280000}]}
```
Показывает, что «осиротеет» при исключении — нет нового значения для сравнения, только текущее.

**Важно:** не больше ОДНОЙ открытой (`DRAFT`/`ON_REVIEW`) заявки на одну позицию плана одновременно — `POST` вернёт 400 при попытке создать вторую. Показывать пользователю понятную ошибку, не ретраить.

### 2.2. Многолетнее резервирование (ТЗ п.5, «ДНК 2026/2027») — информационное, своего UI не требует

Если по позиции плана есть многолетний договор (оплата 2026 и 2027 из бюджета, заключённого в 2026), часть суммы статьи на 2027 год уже «зарезервирована». Это проявляется ТОЛЬКО как уменьшение доступного остатка в формах распределения лимита (`PlanShare`) — ошибка 400 при попытке распределить больше, чем реально доступно, с текстом, упоминающим «уже зарезервировано многолетними договорами». Просто показывать текст ошибки из API, отдельный UI не нужен.

---

## 3. Квартальные лимиты (`BudgetQuarterlyLimit`, `ArticleQuarterlyAllocation`) — фронта нет

### 3.1. Перераспределение лимита между держателями/статьями/кварталами

```
POST /api/change_requests/redistribute/
body: {reason: "...", lines: [{budget_cost: <id>, plan_share: <id>|null, quarter: "Q1"|"Q2"|"Q3"|"Q4", amount: "1234.56"}, ...]}
```
- Минимум 2 строки (откуда и куда). Сумма (новое − старое) по ВСЕМ строкам должна быть равна нулю — иначе 400 («нельзя создавать/терять деньги»).
- `plan_share: null` — строка про лимит статьи целиком (ещё не разбитый по подразделениям).
- Дальше — обычный `submit`/`forecast`/`approve`/`reject` (kind=`LIMIT_REDISTRIBUTION`).
- `forecast` формат: `{"lines": [{"budget_cost_id":.., "economic_code":.., "department":.., "quarter":.., "old_amount":.., "new_amount":.., "delta":..}], "net_delta": 0}`.

**Нужно построить:** форма «Перераспределить лимит» — таблица строк (статья/держатель/квартал/сумма), валидация суммы=0 на клиенте для UX (backend всё равно проверит), дальше стандартный flow заявки.

### 3.2. Приём корректировок от Казначейства (`BUDGET_LIMIT_CORRECTION`)

Это **не прямой upload файла с фронта** — файл `fin_2026.xlsb` сейчас разбирается management-командой `parse_fin_file` на стороне backend (вручную запускается разработчиком/администратором), которая сама создаёт заявку через `cr_service.create_budget_limit_correction()`. **На фронте просто появится уже готовая заявка** (`kind=BUDGET_LIMIT_CORRECTION`, статус `ON_REVIEW` или `DRAFT`) в общем списке `/api/change_requests/`.

**Нужно построить:** в общем списке заявок на изменение показывать этот `kind` и давать её просмотреть/одобрить/отклонить как любую другую. `forecast` формат — такой же, как у перераспределения (`lines`/`net_delta`), но строки — по статьям (`functional_code`/`economic_code`/`year`/`quarter`/`old_amount`/`new_amount`/`delta`), без привязки к позиции плана. Сумма **не обязана быть нулевой** (Казначейство реально меняет объём финансирования).

---

## 4. Договоры, платежи, аналитика (Этап 4) — почти всё на моках

### 4.1. Свободные платёжки (платёж без договора, с привязкой к статье)

```
GET/POST/PATCH/DELETE /api/payments/
```
Поля (`TreasuryPaymentSerializer`): `id, contract, quarter (read-only), payment_number, payment_year, payment_date, save_date, created_at, changed_at, amount, kind, kind_detail, notice, internal_economic_class, internal_economic_class_detail, economic_class, economic_class_detail, functional_class, functional_class_detail, program_class, program_class_detail, departments (M2M), departments_detail`.

`contract` — **nullable**. Пустой `contract` = свободная платёжка. В этом случае обязательно заполнить `departments` (на чьи лимиты относится) и `economic_class`+`functional_class` (или `internal_economic_class`) — статья расходов.

Валидация (сумма ≤ 0, казначейский перерасход по договору) — возвращается как чистый 400 с текстом в `amount`, не 500.

`filterset_fields`: `contract`, `payment_year`, `quarter`, `kind`, `departments`.

Справочник видов платежа: нет отдельного роута, но поле `kind_detail` при чтении платежа отдаёт `{id, name, is_refund}` — для select'а видов платежа понадобится либо завести отдельный GET-эндпоинт (сейчас НЕТ, спросите backend, если нужен список видов платежа отдельно от конкретного платежа), либо собирать уникальные значения из уже загруженных платежей (не рекомендуется — ненадёжно).

**Нужно построить:** форма «Новый платёж» с переключателем «по договору» / «свободный платёж» — во втором случае показывать выбор статьи + подразделений вместо выбора договора.

### 4.2. Реестр договоров

```
GET /api/contracts/
```
Поля (`ContractSerializer`): `id, number, contract_date, supplier, supplier_detail, total_cost, buyer, parent_contract, is_registered_in_treasury, payment_terms, planned_delivery_date, notice, fixed_assets_plan_item, procurement_method_detail, procurement_method_detail_info, construction_type, created_at, items (ContractItemSerializer[]), payments (TreasuryPaymentSerializer[]), days_remaining (int), is_urgent_warning (bool), quarterly_finance (список {year, quarter, planned_cost, actual_cost})`.

**Нужно построить:** отдельная страница реестра договоров (список за год — фильтра по году в API сейчас НЕТ, фильтровать на клиенте по `contract_date` или спросить backend добавить `filterset_fields`), с колонками: номер, дата, контрагент, сумма, `is_urgent_warning` (просрочка — подсветить), `days_remaining`.

### 4.3. Ручная корректировка квартального плана договора

```
GET/POST/PATCH/DELETE /api/contract_quarterly_finance/   (фильтры: contract, contract_item, year, quarter)
```
Поля: `id, contract, contract_item, quarter, year, planned_cost, actual_cost`.

`actual_cost` пересчитывается автоматически backend'ом по платежам — **не давать его редактировать в UI** (хотя API технически позволяет PATCH, с ним будет гонка с автопересчётом). `planned_cost` — то, что специалист правит руками. Валидация «факт нарастающим итогом ≤ сумма договора» — чистый 400 на `actual_cost`.

**Нужно построить:** на карточке договора — таблица кварталов (year×quarter), редактируемое поле `planned_cost`, `actual_cost` — только для чтения.

### 4.4. Отчёт «назначено — обязательства — оплачено — остаток»

```
GET /api/reports/budget_execution/?year=2026&department=5&quarter=Q2
```
Все параметры опциональны. Ответ — ПЛОСКИЙ список (backend группировку по иерархии подразделений и уровням классификатора не делает):
```json
[{"department_id":5, "department":"ГУФиТ", "year":2026, "quarter":"Q2", "internal_economic_class_id":10, "internal_economic_class_code":"1101008169", "internal_economic_class_name":"...", "allocated": 500000, "committed_obligations": 450000, "paid": 300000, "remainder": 50000}]
```
`allocated` и `committed_obligations` — независимые столбцы (НЕ вычитаются друг из друга автоматически, `remainder = allocated − committed_obligations`). Группировку по дереву подразделений (`Department.parent`, см. `/api/departments/`) и по уровням классификатора (`InternalEconomicClassifier.parent`, см. `/api/internal_economic_code/`) нужно строить на фронте из уже загруженных деревьев справочников.

**Нужно построить:** страница отчёта — таблица с разворачиваемыми группами (по подразделению и/или по статье), фильтры год/подразделение/квартал.

---

## 5. Интеграция с goszakupki.by (Этап 5)

### Pull (синхронизация с портала)
```
GET /api/gosakupki/get_purchases_all           — список годовых планов с портала, сразу сохраняет в БД
GET /api/gosakupki/get_purchases_items/{id}/   — детали позиций плана {id} (purchase_id из Purchases.purchase_id), сразу синхронизирует в БД
```
Ответ — статистика синхронизации: `{"status":"success","details":{"TOTAL_PLAN_ITEM_COUNT":.., "imported_plan_item_count":.., "updated_plan_item_count":.., "skiped_plan_item_count":.., ...}}`. Может вернуть 502, если портал недоступен (реальная сеть к `api.goszakupki.by` из dev-среды backend-агента недоступна — это нормально, тестировать будет пользователь/вы с рабочей сети).

**Нужно построить:** кнопка «Синхронизировать с ЭТП (goszakupki.by)» на странице плана — вызывает `get_purchases_items`, показывает статистику/ошибку.

### Push (отправка изменений на портал)
```
POST /api/goszakupki/push-plan-items/    body: {plan_item_ids: [1, 2, 3]}
POST /api/goszakupki/delete-plan-items/  body: {plan_item_ids: [1, 2, 3]}
```
Ответ push: `{"succeeded": [{"plan_item_id":1, "num":"...", "action":"create"|"update", "purchases_item_id":123}], "failed": [{"plan_item_id":2, "error":"..."}]}`. Ошибка на одной позиции не прерывает отправку остальных — **показывать succeeded/failed раздельно**, не как единый успех/провал.

Непубликуемые позиции (`is_public=false`) отправить нельзя — придёт `error` в `failed`.

**Нужно построить:** на карточке одобренной заявки (`PLAN_ITEM_CHANGE`/`PLAN_ITEM_EXCLUSION`, статус `APPROVED`) — кнопка «Отправить на goszakupki.by» → push для изменённых позиций / delete для исключённых.

---

## 6. Справочники — уже готово, без изменений

ЭКР, внутренние коды, ОКРБ, главки, закупщики, поставщики — всё работает (см. `frontend/docs/CurrentStatus.md`). Ничего нового не добавилось. Единственное замечание: **поиск по `/api/plan_items/` сейчас не работает** (`search_fields` закомментирован на backend, параметр `?search=` ничего не делает) — это подтверждённый, не исправленный баг backend, не ждите, что он появится сам. Параметр `?purchase=<id>` на `/api/plan_items/` **работает** (несмотря на то, что отсутствует в OpenAPI-схеме — обрабатывается вручную в `get_queryset()`, не через `django-filter`) — можете продолжать его слать.

---

## 7. Этап 9 — Отчёт «Общие деньги» + калибровка лимитов по подразделениям (самое новое, сделано только что)

### 7.1. Отчёт «Общие деньги»

```
GET /api/reports/general_money/?year=2026
```
Одна строка на статью (без разбивки по подразделениям — это org-wide отчёт, в отличие от 4.4):
```json
[{
  "functional_class_id": 10, "economic_class_id": 3,
  "functional_code": "03 12 00 039", "economic_code": "1 10 03 99",
  "economic_description": "1.10.03.99 Приобретение предметов снабжения и расходных материалов",
  "year": 2026,
  "planned_annual": 1449467.0,
  "prior_years_obligations": 0.0,
  "allocated_limit": 0.0,
  "unassigned_limit": 1449467.0,
  "entered_into_plan": 1308876.54,
  "committed_obligations": 1283885.21,
  "paid_actual": 1078548.46,
  "unallocated_limit": -1308876.54,
  "remainder_unobligated": 165581.79,
  "remainder_with_actual": 370918.54
}]
```
Колонки (русские названия для UI):
| Поле | Заголовок | Формула |
|---|---|---|
| `planned_annual` | Плановое назначение на год | сумма кварталов Казначейства |
| `prior_years_obligations` | Принятые обязательства прошлых лет | многолетние договоры |
| `allocated_limit` | Доведённые лимиты | сумма по подстатьям (см. 7.2) |
| `unassigned_limit` | Нераспределённые лимиты | план − обязательства прошлых лет − доведено |
| `entered_into_plan` | Внесено в ГПЗ (публ.+непубл.) | сумма BudgetCosts.cost |
| `committed_obligations` | Принято обязательств | договоры текущего года |
| `paid_actual` | Фактическая оплата | нетто платежи |
| `unallocated_limit` | Остаток незапланированных средств | доведено − внесено в ГПЗ |
| `remainder_unobligated` | Остаток от принятых обязательств | план − обязательства − обязательства прошлых лет |
| `remainder_with_actual` | Остаток с учётом фактических расходов | план − факт. оплата |

**⚠️ `allocated_limit`/`unallocated_limit` будут нулевыми/отрицательными для ВСЕХ строк, пока по статье не проведена калибровка (раздел 7.2) — это НЕ баг отчёта, это означает «калибровку ещё не делали».** Хорошо бы на фронте явно показывать это состояние (например, серым текстом «калибровка не проведена»), а не просто минус в столбце.

**Нужно построить:** страница отчёта — простая таблица (без дерева, в отличие от 4.4), фильтр по году.

### 7.2. Калибровка лимитов по подразделениям — именно этот пункт меню «Корректировка лимитов» уже есть в сайдбаре, но без роута (`url: "#"`)

Это заявка на изменение (`kind=DEPARTMENT_LIMIT_CALIBRATION`), работает через тот же `ChangeRequest`, но со своим входом для создания и своей сверкой.

**Создание заявки:**
```
POST /api/change_requests/calibrate_department_limits/
body: {functional_class: <id>, economic_class: <id>, year: 2026, reason: "..."}
```
Клонирует ТЕКУЩИЕ действующие строки разбивки этой статьи/года в черновик (если калибровка уже была раньше) — черновик стартует НЕ с нуля. Если это первая калибровка статьи — черновик стартует пустым, строки добавляются вручную (см. ниже).

**Редактирование строк черновика:**
```
GET/POST/PATCH/DELETE /api/department_article_limits/   (фильтры: status, change_request, functional_class, economic_class, department, year)
```
Поля (`DepartmentArticleLimitSerializer`): `id, status, functional_class, functional_code, economic_class, economic_code, internal_economic_class, internal_economic_class_code, department, department_name, year, amount, change_request, created_at, changed_at`.

**Два уровня строк одной и той же модели:**
- `department: null` — сумма на ПОДСТАТЬЮ целиком (внутренний классификатор ГКСЭ, `/api/internal_economic_code/`), ещё не разбитая по подразделениям.
- `department: <id>` — доля конкретного держателя лимита в этой подстатье.

Создание новой строки черновика: `POST /api/department_article_limits/` с `change_request: <id>`, `status: "DRAFT"`, и остальными полями.

**Сверка (самое важное для UX):**
```
GET /api/change_requests/{id}/forecast/
```
```json
{
  "functional_code": "03 12 00 039", "economic_code": "1 10 03 99", "year": 2026,
  "article_total": 500000, "prior_years_obligations": 150000, "article_available": 350000,
  "subarticle_sum": 300000, "article_diff": 50000,
  "subarticle_lines": [{"internal_economic_class_id": 1, "internal_economic_class_code": "1100300001", "amount": 300000}],
  "department_lines": [{"internal_economic_class_id": 1, "internal_economic_class_code": "1100300001", "department": "ГУФиТ", "amount": 200000}],
  "subarticle_balance": [{"internal_economic_class_id": 1, "internal_economic_class_code": "1100300001", "subarticle_total": 300000, "departments_sum": 200000, "diff": 100000}],
  "is_balanced": true
}
```
**Правило подсветки (ВАЖНО, не то, что вы могли бы ожидать от слова «сверка»):**
- `article_diff` и каждый `subarticle_balance[i].diff` — это ОСТАТОК (сколько ещё можно распределить), а НЕ обязательная к устранению разница.
- **`diff >= 0` → жёлтый/нейтральный («есть нераспределённый остаток») — это НОРМАЛЬНОЕ, допустимое состояние, не ошибка.**
- **`diff < 0` → красный («перерасход», распределено больше, чем есть) — это блокирующая ошибка.**
- `is_balanced: true` означает «нет перерасхода НИГДЕ» — именно это (и только это) разрешает нажать «Одобрить». `is_balanced: false` с положительными diff'ами НЕ должно происходить (логическая гарантия backend), но если увидите — это баг, сообщите backend.
- `article_available = article_total − prior_years_obligations` — именно с этим числом сравнивается `subarticle_sum`, не с `article_total` напрямую (резерв многолетних договоров вычитается заранее).

`POST /api/change_requests/{id}/approve/` при `is_balanced: false` вернёт 400 с текстом про перерасход — показывать как есть.

**Нужно построить:** страница «Корректировка лимитов» (это и есть пункт сайдбара):
1. Выбор статьи (functional_class+economic_class, список статей — из `/api/reports/general_money/` или отдельно спросить backend справочник статей, если нужен независимо от отчёта) + года → кнопка «Начать калибровку» → `calibrate_department_limits`.
2. Таблица: подстатьи (строки `department=null`) с возможностью развернуть и добавить держателей (строки `department=<id>`) — редактирование сумм инлайн.
3. Живая сверка (дёргать `forecast` при каждом изменении, debounce) — два уровня подсветки как описано выше.
4. Кнопки submit/approve/reject как у любой заявки.

---

## 8. Порядок работы (рекомендация, не требование)

Backend уже всё перечисленное реализовал и покрыл тестами (45 тестов, `manage.py test procurement`) — но **ни разу не проверял через реальный UI**, только через `curl`/Swagger. Поэтому при подключении возможны мелкие расхождения (не указан какой-то фильтр, не хватает поля) — **сообщайте backend-агенту/пользователю, не придумывайте обходные пути молча**.

Порядок — на ваше усмотрение, но пользователь просил: **разделы 1-6 (вся предыдущая работа) и раздел 7 (Общие деньги + калибровка) должны быть откатаны на фронте, прежде чем backend возьмётся за следующий отчёт**. Можно идти по степени готовности текущего фронта: разделы 4.2/4.3 (договоры) и 4.1 (платежи) ближе всего к завершению (моки уже есть, просто подключить реальный API); разделы 2/3/7 — полностью новый UI с нуля (workflow заявок).

---

## 9. Запрос от фронтенда к бэкенду (добавлено 2026-11-05, согласовано с пользователем)

### 9.1. Количество договоров вместо просто "есть/нет" в `PlanItemShort.contracts`

**Где используется:** `/plan-items` (Реестр закупок), столбец «Наличие договора». Сейчас там плашка Да/Нет.
Хотим показывать количество: «Да (4)» вместо просто «Да».

**Текущая реализация** (`procurement/serializers/planItem.py`, `PlanItemShortSerializer.get_contracts()`,
строки 86-95):

```python
@extend_schema_field(serializers.BooleanField)
def get_contracts(self, obj):
    active_budgets = obj.budget_costs.filter(status=PlanItemStatus.ACTIVE)
    plan_shares = PlanShare.objects.filter(
        budget_cost__in=active_budgets,
        status=PlanItemStatus.ACTIVE
    )
    contracts_queryset = ContractItem.objects.filter(plan_share__in=plan_shares).distinct()

    return contracts_queryset.exists()
```

`contracts_queryset` — это `ContractItem` (строки договора), не сами `Contract`. Для «количества
договоров» важно считать **уникальные `Contract`**, а не строки-позиции (у одного договора может
быть несколько `ContractItem` на разные `plan_share`/подразделения этой же позиции плана — см.
`CurrentStatus.md` backend, пример `2026-102377498-66`, 14 договоров на охрану от разных отделов).
Т.е. нужно что-то вроде:

```python
contracts_queryset.values("contract").distinct().count()
```

**Просим:** добавить в `PlanItemShortSerializer` новое поле, например `contracts_count` (int) —
число уникальных договоров, по формуле выше. Поле `contracts` (boolean) просьба **не убирать и не
менять его смысл** — не проверяли, использует ли его что-то ещё помимо этого столбца, менять
семантику существующего поля без необходимости не хотим. `contracts_count` — отдельное,
дополнительное поле.

После того как поле появится и вы перегенерируете/подтвердите схему — на фронте просто подставим
`contracts_count` в текст плашки (`"Да (" + count + ")"` вместо `"Да"`) и обновим `frontend_handoff.md`/
`CurrentStatus.md`, ничего большего не требуется.
