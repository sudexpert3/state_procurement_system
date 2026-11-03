# -*- coding: utf-8 -*-
"""
Отправка одобренных изменений позиций ГПЗ на goszakupki.by (ТЗ п.3, 16: «Если план
одобрен, то ответственный за план может посредством API передать на сайт goszakupki.by
черновик с изменениями. Ему останется только войти в личный кабинет на goszakupki.by,
проверить черновик и опубликовать изменения, подписав их ЭЦП»).

Реализовано строго по doc/api.yaml (POST /purchase/create-item/{purchase_id}, PUT
/purchase/update-item/{id}, PUT /purchase/delete-items/{purchase_id}) — никаких
придуманных эндпоинтов/полей. Старая версия (procurement/services/goszakupki_api.py,
удалена) обращалась к несуществующему /v1/procurement/plans/drafts и несуществующим
полям модели (plan_goszakupki_id вместо реального PlanItemDetail.purchases_item_id,
PlanItem.status которого нет) — см. CurrentStatus.md, Этап 5.

Два расхождения со спецификацией, отмеченные осознанно (не исправлены «на глаз», а
прямо задокументированы, т.к. реальный прогон против портала из этой среды недоступен —
см. export_goszakupki_plan.py):
- doc/api.yaml указывает val_amount/fund_cost/inner_cost/cost как type: integer, хотя
  это явно денежные/количественные величины с реальными копейками/долями (в БД —
  DecimalField). Передаём float как есть, не округляя — если портал в реальности строго
  требует integer, это проявится конкретной 400-ошибкой при первом живом тесте, что
  безопаснее тихого обрезания копеек.
- purchase_costs 'number' (порядковый номер) не хранится у нас отдельным полем — генерируем
  как 1..N по порядку ACTIVE BudgetCosts позиции (сам API использует его только как метку
  строки внутри payload, не как бизнес-идентификатор).
"""
from api.api import GoszakupkiAPI
from core.choices import PlanItemStatus
from procurement.models import PlanItem


def _build_item_payload(detail):
    """Собирает payload под схему create-item/update-item (doc/api.yaml) из ACTIVE
    PlanItemDetail и ACTIVE BudgetCosts его позиции плана."""
    budget_costs = detail.plan_item.budget_costs.filter(status=PlanItemStatus.ACTIVE).order_by('year', 'id')
    return {
        "title": detail.title,
        "okrb": detail.okrb,
        "type": detail.type,
        "val_type": detail.val_type,
        "val_amount": float(detail.val_amount),
        "procedure_months": detail.procedure_months or [],
        "is_by_organizator": detail.is_by_organizator,
        "fund_cost": float(detail.fund_cost),
        "inner_cost": float(detail.inner_cost),
        "unp_budget": detail.unp_budget,
        "budget_costs": [
            {
                "number": i,
                "cost": float(bc.cost),
                "functional_code": bc.functional_code,
                "department_code": bc.department_code,
                "economic_code": bc.economic_code,
                "program_code": bc.program_code,
                "year": bc.year,
                "budget_code": bc.budget_code,
            }
            for i, bc in enumerate(budget_costs, start=1)
        ],
    }


def push_plan_item(plan_item):
    """Отправляет ОДНУ позицию плана на goszakupki.by: create-item, если её там ещё нет
    (detail.purchases_item_id пуст), иначе update-item. Непубликуемые позиции на портал не
    передаются (ТЗ п.4) — вызывающий код должен сам отфильтровать is_public перед вызовом,
    здесь же дополнительно проверяется как защита от ошибки вызывающего кода."""
    if not plan_item.is_public:
        raise ValueError(f"Позиция {plan_item.num} непубликуемая — не передаётся на goszakupki.by")

    detail = plan_item.details.filter(status=PlanItemStatus.ACTIVE).order_by('-id').first()
    if not detail:
        raise ValueError(f"У позиции {plan_item.num} нет действующей (ACTIVE) версии для отправки")

    client = GoszakupkiAPI()
    payload = _build_item_payload(detail)

    if detail.purchases_item_id:
        data, _headers = client.put_data(f"/purchase/update-item/{detail.purchases_item_id}", payload)
        action = "update"
    else:
        if not detail.purchases_id:
            raise ValueError(
                f"У позиции {plan_item.num} не указан purchases_id (ID годового плана на "
                "портале) — сначала синхронизируйте годовой план (Purchases.purchase_id)"
            )
        data, _headers = client.post_data(f"/purchase/create-item/{detail.purchases_id}", payload)
        action = "create"
        detail.purchases_item_id = data.get('id')
        update_fields = ['purchases_item_id']
        if data.get('num') and data['num'] != plan_item.num:
            detail.num = data['num']
            plan_item.num = data['num']
            plan_item.save(update_fields=['num'])
            update_fields.append('num')
        detail.save(update_fields=update_fields)

    return {
        "plan_item_id": plan_item.id,
        "num": plan_item.num,
        "action": action,
        "purchases_item_id": detail.purchases_item_id,
    }


def push_plan_items(plan_item_ids):
    """Пакетная отправка — ошибка на одной позиции не прерывает отправку остальных."""
    succeeded, failed = [], []
    for plan_item_id in plan_item_ids:
        try:
            plan_item = PlanItem.objects.get(pk=plan_item_id)
            succeeded.append(push_plan_item(plan_item))
        except PlanItem.DoesNotExist:
            failed.append({"plan_item_id": plan_item_id, "error": "Позиция плана не найдена"})
        except Exception as exc:
            failed.append({"plan_item_id": plan_item_id, "error": str(exc)})
    return {"succeeded": succeeded, "failed": failed}


def delete_plan_items(plan_item_ids):
    """Удаление позиций на портале (PUT /purchase/delete-items/{purchase_id}, ТЗ: исключение
    позиции из ГПЗ). Эндпоинт принимает ID позиций ОДНОГО плана за раз — группируем по
    purchases_id. Локальный статус позиции (архивация и т.п.) этой функцией не меняется —
    это уже делает procurement.services.change_requests._approve_exclusion()."""
    items = PlanItem.objects.filter(pk__in=plan_item_ids)
    by_purchase = {}
    skipped = []
    for plan_item in items:
        detail = plan_item.details.filter(status=PlanItemStatus.ACTIVE).order_by('-id').first()
        if not detail or not detail.purchases_item_id or not detail.purchases_id:
            skipped.append({
                "plan_item_id": plan_item.id,
                "reason": "нет данных портала (purchases_id/purchases_item_id) — позиция, видимо, не публиковалась",
            })
            continue
        by_purchase.setdefault(detail.purchases_id, []).append(detail.purchases_item_id)

    client = GoszakupkiAPI()
    deleted_ids = []
    failed = []
    for purchases_id, item_ids in by_purchase.items():
        try:
            data, _headers = client.put_data(f"/purchase/delete-items/{purchases_id}", {"ids": item_ids})
            deleted_ids.extend(data or [])
        except Exception as exc:
            failed.append({"purchases_id": purchases_id, "item_ids": item_ids, "error": str(exc)})

    return {"deleted_purchases_item_ids": deleted_ids, "skipped": skipped, "failed": failed}
