# for-ai.md — статус проекта для Claude Code

> Служебный файл. Обновляй его при завершении крупных фич/сессий, чтобы не перечитывать весь проект заново.
> Дата последней актуализации: 2026-07-12, ветка `feature/inner-codes`.

## Стек

- React 19 + React Router 7 (data router, `lazy` per-route)
- shadcn/ui (компоненты лежат в `src/shared/components/ui/`, НЕ в `src/shared/ui/kit/`, как написано в CLAUDE.md — фактическая структура разошлась с документом)
- Zod v4 + React Hook Form
- TanStack Query v5 (`openapi-react-query` через `rqClient`) + TanStack Table v8
- TailwindCSS v4

## Структура (фактическая)

```
src/
  app/           # router.tsx, main-layout, protected-route, providers
  features/      # см. статус фич ниже
  shared/
    api/         # instance.ts (rqClient), schema/, types/api.ts (генерируется)
    components/
      data-table/  # общий DataTable на tanstack-table
      form/
      ui/          # shadcn-компоненты (не shared/ui/kit!)
    lib/helpers/, lib/react/
    model/routes.ts   # ROUTES + типизация path-параметров
```

Модуля `services/` пока нет — переиспользуемой бизнес-логики между фичами не выделялось.

## Статус фич по разделам сайдбара

| Раздел (label в сайдбаре)         | Роут                   | Фича                           | Статус                                                                                                                                                                                                                                                                                                     |
| --------------------------------- | ---------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Годовые планы                     | `/plans`               | `features/plans`               | ✅ Готово. Таблица через `DataTable`, реальный API (`GET /api/purchases/`), клик по строке → переход в реестр закупок с фильтром по плану. CRUD/drawer не реализован (пока read-only реестр)                                                                                                               |
| Реестр закупок                    | `/plan-items`          | `features/plan-items/list`     | ✅ Готово. Таблица, колонки с видимостью (column-visibility-dropdown), реальный API                                                                                                                                                                                                                        |
| Реестр закупок → карточка         | `/plan-items/:id`      | `features/plan-items/detail`   | 🟡 Частично. Таб «Информация» — реальный API (`plan-items/{id}/`). Табы «Планирование» и «Договоры» ещё на моках (`procurement.mock.ts`, `plan2`). Таб «Платежи» — заглушка-текст, эндпоинт не подключён. Статус плана (Badge) закомментирован — ждём уточнения от бэка (`//TODO узнать про статус плана`) |
| Реестр закупок → создание         | `/plan-items/add`      | `features/plan-items/create`   | 🟡 Форма готова визуально (табы: основная информация, планирование, договоры с quarter-table на 30 договоров через drawer), но `onSubmit` НЕ отправляет на бэкенд — просто `toast.info` + локальный state. Раздел договоров использует моки (`contracts.mock.ts`)                                          |
| ЭКР (экономическая классификация) | `/economic-code`       | `features/economic-code`       | ✅ Готово. Переписана 2026-07-12 по паттерну `code-okrb`: реальный API (`/api/economic_code/`, тип `EconomicCode` = `ExternalEconomicCode`), drawer CRUD, поиск (server-side `search`) + фильтр по `is_active` (server-side), сортировка. Раньше была на моках с полем `parent_id` — иерархии в API нет, справочник плоский |
| Коды ОКРБ                         | `/codes-okrb`          | `features/code-okrb`           | ✅ Готово. Тот же паттерн (drawer CRUD + delete-dialog), реальный API                                                                                                                                                                                                                                      |
| Главки                            | `/departments`         | `features/departments`         | ✅ Готово. Тот же паттерн, реальный API                                                                                                                                                                                                                                                                    |
| Закупщики                         | `/buyers`              | `features/buyers`              | ✅ Готово. Тот же паттерн, реальный API                                                                                                                                                                                                                                                                    |
| Поставщики                        | `/suppliers`           | `features/suppliers`           | ✅ Готово. Тот же паттерн, реальный API                                                                                                                                                                                                                                                                    |
| Корректировка лимитов             | —                      | —                              | ❌ Не реализовано, пункт в сайдбаре без роута                                                                                                                                                                                                                                                              |
| Авторизация                       | `/login`               | `features/auth`                | ✅ Есть login-форма и `ProtectedRoute` (bearer-токен из localStorage)                                                                                                                                                                                                                                      |

## Общий CRUD-паттерн справочников (ЭКР, ОКРБ, главки, закупщики, поставщики)

Все 5 справочников сделаны одинаково — если добавляется новый справочник, копировать этот паттерн:

- `<name>.page.tsx` — таблица (`DataTable`) + `drawerOpen` state + toolbar с поиском
- `<name>-form.tsx` / `form/<name>-form.tsx` — форма в Drawer (create/update)
- `<name>.schema.ts` — Zod-схема
- `columns.tsx` — колонки tanstack-table
- `use-<name>s.ts`, `use-<name>-delete.ts` — хуки на `rqClient`
- Удаление — через confirm-dialog

## Что нужно знать перед следующей задачей в plan-items/detail

- Ветка `feature/plan-item-detail` — сейчас в работе именно карточка плана закупки
- `procurement.mock.ts` и `plan2` в `plan-item-detail.page.tsx` — временный костыль, вытеснять по мере готовности бэкенд-эндпоинтов для договоров/планирования/платежей
- Есть параллельная реализация contract-section в `create/form/contract-section/` — при подключении реального API для договоров в detail, вероятно, логику/схему (`quarter.schema.ts`, `helpers.ts`) можно переиспользовать, а не писать заново
