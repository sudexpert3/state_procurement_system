# -*- coding: utf-8 -*-
"""
Разовая чистка задвоенных ACTIVE-записей PlanItemDetail, накопленных из-за бага в
PlanItemDetailImportSerializer.create() (см. комментарий в serializers/planItemDetail.py
и CurrentStatus.md, находка 2026-10-27): при расхождении значений между синхронизациями
создавалась новая запись, но старая ACTIVE не архивировалась — на момент находки 22
позиции плана имели по 2 записи со статусом ACTIVE одновременно. Баг в create() уже
исправлен (версионирование archive-then-create), эта команда разово убирает накопившиеся
дубли АРХИВАЦИЕЙ (не удалением — в отличие от первой, ошибочной попытки с BudgetCosts,
см. dedupe_budget_costs.py и CurrentStatus.md).

Для каждой группы дублей (один `plan_item`, больше одной ACTIVE записи PlanItemDetail):
  - "хранитель" (keeper) — самая свежая по created_at запись (отражает последнее
    реальное состояние с портала);
  - на неё переносятся buyer/beneficiary_departments с более старой записи, если на
    "хранителе" они ещё не проставлены (это локальная ГКСЭ-разметка, портал о ней не
    знает — не должна теряться при версионировании);
  - все остальные записи группы переводятся в status=ARCHIVE (данные не меняются —
    это и есть история).

Запуск (из backend/):
    python manage.py archive_duplicate_details                # только отчёт, не трогает БД
    python manage.py archive_duplicate_details --apply         # реально сохраняет изменения
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count

from core.choices import PlanItemStatus
from procurement.models import PlanItemDetail


class Command(BaseCommand):
    help = 'Архивирует задвоенные ACTIVE-записи PlanItemDetail (один plan_item, больше одной ACTIVE).'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true',
                            help='Реально сохранить изменения. Без флага — только отчёт (dry-run).')

    def handle(self, *args, **options):
        apply_changes = options['apply']
        mode = 'ПРИМЕНЕНО' if apply_changes else 'DRY-RUN (изменения НЕ сохранены)'

        dup_groups = list(
            PlanItemDetail.objects.filter(status=PlanItemStatus.ACTIVE)
            .values('plan_item_id').annotate(n=Count('id')).filter(n__gt=1)
        )

        self.stdout.write(f'=== Режим: {mode} ===')
        self.stdout.write(f'Найдено позиций плана с задвоенным ACTIVE: {len(dup_groups)}')

        archived_total = 0
        details_log = []

        with transaction.atomic():
            for g in dup_groups:
                records = list(PlanItemDetail.objects.filter(
                    plan_item_id=g['plan_item_id'], status=PlanItemStatus.ACTIVE,
                ).order_by('created_at'))

                keeper = records[-1]  # самая свежая
                older = records[:-1]

                if not keeper.buyer_id or keeper.beneficiary_departments.count() == 0:
                    for o in older:
                        if not keeper.buyer_id and o.buyer_id:
                            keeper.buyer_id = o.buyer_id
                        if keeper.beneficiary_departments.count() == 0:
                            depts = list(o.beneficiary_departments.all())
                            if depts and apply_changes:
                                keeper.beneficiary_departments.set(depts)
                    if apply_changes:
                        keeper.save(update_fields=['buyer'])

                for o in older:
                    archived_total += 1
                    details_log.append((g['plan_item_id'], o.id, keeper.id))
                    if apply_changes:
                        o.status = PlanItemStatus.ARCHIVE
                        o.save(update_fields=['status', 'changed_at'])

            if not apply_changes:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(
            f"Обработано групп: {len(dup_groups)}. Заархивировано записей: {archived_total}."))
        for plan_item_id, old_id, keeper_id in details_log[:50]:
            self.stdout.write(f'  plan_item={plan_item_id} | архив: id={old_id} -> хранитель: id={keeper_id}')
        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                'Это был предварительный прогон. Для реального сохранения запустите с флагом --apply.'))
