# -*- coding: utf-8 -*-
"""
Общая логика синхронизации PlanItem/PlanItemDetail/BudgetCosts из данных API goszakupki.by.

Вынесена из views/get_data_from_goszakupki.py (get_purchases_items), где раньше была
только "вживую" (HTTP-вью, читающая тестовый api_data.json). Формат `result_data` —
список объектов позиций плана вида {id, purchases_id, num, title, ..., budget_costs: [...]},
как отдаёт /purchase/view-item/{id} на goszakupki.by (см. export_goszakupki_plan.py).

Используется:
  - views/get_data_from_goszakupki.py::get_purchases_items — HTTP-эндпоинт (тестовые данные);
  - management/commands/sync_goszakupki_from_file.py — офлайн-синхронизация из выгруженного
    файла, когда прямого доступа к api.goszakupki.by нет (см. export_goszakupki_plan.py).
"""
from django.db import transaction

from core.choices import PlanItemStatus
from procurement.models import PlanItem, PlanItemDetail, BudgetCosts
from procurement.serializers import PlanItemDetailImportSerializer, BudgetCostsImportSerializer


def sync_plan_items_from_data(purchase_master, result_data, log=None):
    """
    Идемпотентно создаёт/обновляет PlanItem+PlanItemDetail+BudgetCosts из result_data,
    привязывая их к purchase_master (строка Purchases для конкретного года/плана).
    Позиции, которые раньше были активны в БД для этого purchase_master, но пропали
    из result_data (сняты/исключены на портале), переводятся в is_active=False + ARCHIVE.

    log: необязательная функция для построчного прогресса (например, self.stdout.write).
    Возвращает словарь со статистикой.
    """
    log = log or (lambda *a, **kw: None)
    total = len(result_data)
    stats = {
        'total': total, 'imported': 0, 'updated': 0, 'skipped': 0,
        'budget_imported': 0, 'budget_updated': 0, 'archived': 0,
    }

    with transaction.atomic():
        for numer, raw_item in enumerate(result_data, start=1):
            external_item = dict(raw_item)  # не мутируем данные вызывающего кода
            purchases_item_id = external_item.get('id')
            num = external_item.get('num')

            if not purchases_item_id or not num:
                stats['skipped'] += 1
                continue

            local_plan_item = PlanItem.objects.filter(num=num, is_active=True).first()
            if not local_plan_item:
                local_plan_item = PlanItem.objects.create(
                    plan_purchase=purchase_master, num=num, is_public=True, is_active=True,
                )
                stats['imported'] += 1
            else:
                stats['updated'] += 1

            external_item['plan_item'] = local_plan_item.id
            external_item['purchases_item_id'] = purchases_item_id
            plan_item_serializer = PlanItemDetailImportSerializer(data=external_item)
            plan_item_serializer.is_valid(raise_exception=True)
            plan_item_serializer.save()

            budget_costs_data = external_item.get('budget_costs') or []
            if budget_costs_data:
                for bc_item in budget_costs_data:
                    bc_item['plan_item'] = local_plan_item.id
                bc_serializer = BudgetCostsImportSerializer(data=budget_costs_data, many=True)
                bc_serializer.is_valid(raise_exception=True)
                saved_bc_objects = bc_serializer.save()
                for bc_obj in saved_bc_objects:
                    if bc_obj.created_at == bc_obj.changed_at:
                        stats['budget_imported'] += 1
                    else:
                        stats['budget_updated'] += 1

            if numer % 100 == 0 or numer == total:
                log(f'  [{numer}/{total}] обработано (создано {stats["imported"]}, обновлено {stats["updated"]})')

        # --- архивирование позиций, пропавших с портала ---
        external_nums_on_site = {item.get('num') for item in result_data if item.get('num')}
        local_active_plans_qs = PlanItem.objects.filter(
            plan_purchase=purchase_master, is_active=True, is_public=True, num__isnull=False,
        ).values_list('id', 'num')

        items_to_extinguish = [pid for pid, pnum in local_active_plans_qs if pnum not in external_nums_on_site]

        if items_to_extinguish:
            PlanItem.objects.filter(id__in=items_to_extinguish).update(is_active=False)
            PlanItemDetail.objects.filter(plan_item_id__in=items_to_extinguish).update(status=PlanItemStatus.ARCHIVE)
            BudgetCosts.objects.filter(plan_item_id__in=items_to_extinguish).update(status=PlanItemStatus.ARCHIVE)
            stats['archived'] = len(items_to_extinguish)
            log(f'  Заархивировано (пропали с портала): {len(items_to_extinguish)}')

    return stats
