# -*- coding: utf-8 -*-
"""
Разовая чистка задвоенных записей BudgetCosts, накопленных из-за бага в
BudgetCostsImportSerializer.create() (см. комментарий в serializers/budgetCosts.py и
CurrentStatus.md, находка 2026-10-27): критерий поиска "уже существующей" записи включал
`cost`, поэтому при пересмотре суммы на портале между синхронизациями старая запись не
находилась и создавалась новая — старая зависала сиротой. Баг в create() уже исправлен,
эта команда разово убирает накопившиеся дубли.

Для каждой группы дублей (один `plan_item` + `year` + `budget_code`, больше одной записи):
  1. "Хранитель" (keeper) — запись с заполненным internal_economic_class (ручная
     классификация ГКСЭ, см. import_reestr26.py — портал о ней не знает и её нельзя
     потерять), либо, если ни у одной не заполнено — самая старая по created_at.
  2. На "хранителя" переносятся "свежие" (по created_at) значения полей, которые приходят
     с портала (cost, purchases_items_id, functional_code, economic_code, program_code,
     budget_code_name, unk, tk_id и производные *_class) — так "хранитель" получает
     актуальную сумму, не теряя свою классификацию ЭКР.
  3. Если у записей-доноров есть PlanShare — переприкрепляем их к "хранителю" (FK
     PlanShare.budget_cost защищён PROTECT, удалить donor с висящим PlanShare нельзя).
     Если у "хранителя" уже ЕСТЬ PlanShare на то же подразделение — конфликт, группа
     пропускается с пометкой "нужна ручная проверка" (не трогаем).
  4. Записи-доноры удаляются.

Запуск (из backend/):
    python manage.py dedupe_budget_costs                # только отчёт, не трогает БД
    python manage.py dedupe_budget_costs --apply         # реально сохраняет изменения
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count

from procurement.models import BudgetCosts, PlanShare


class Command(BaseCommand):
    help = 'Чистка задвоенных BudgetCosts (один plan_item+year+budget_code, больше одной записи).'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true',
                            help='Реально сохранить изменения. Без флага — только отчёт (dry-run).')

    def handle(self, *args, **options):
        apply_changes = options['apply']
        mode = 'ПРИМЕНЕНО' if apply_changes else 'DRY-RUN (изменения НЕ сохранены)'

        mutable_fields = (
            'purchases_items_id', 'cost', 'functional_code', 'department_code', 'economic_code',
            'program_code', 'budget_code_name', 'unk', 'tk_id',
            'functional_class_id', 'economic_class_id', 'program_class_id',
        )

        dup_groups = list(
            BudgetCosts.objects.values('plan_item_id', 'year', 'budget_code')
            .annotate(n=Count('id')).filter(n__gt=1)
        )

        self.stdout.write(f'=== Режим: {mode} ===')
        self.stdout.write(f'Найдено задвоенных групп: {len(dup_groups)}')

        resolved = 0
        reassigned_shares = 0
        deleted_total = 0
        conflicts = []

        with transaction.atomic():
            for g in dup_groups:
                records = list(BudgetCosts.objects.filter(
                    plan_item_id=g['plan_item_id'], year=g['year'], budget_code=g['budget_code'],
                ).order_by('created_at'))

                # "Хранитель" — у кого заполнена ручная классификация ЭКР; иначе — старейший.
                with_iec = [r for r in records if r.internal_economic_class_id]
                keeper = with_iec[0] if with_iec else records[0]
                donors = [r for r in records if r.pk != keeper.pk]
                freshest = records[-1]  # по created_at — самые актуальные "сырые" поля с портала

                # --- проверка конфликтов PlanShare ДО каких-либо изменений ---
                keeper_depts = set(
                    PlanShare.objects.filter(budget_cost=keeper).values_list('department_id', flat=True)
                )
                donor_shares = list(PlanShare.objects.filter(budget_cost__in=donors))
                conflict_shares = [s for s in donor_shares if s.department_id in keeper_depts]
                if conflict_shares:
                    conflicts.append((g, [s.id for s in conflict_shares]))
                    continue  # группу не трогаем вовсе — нужна ручная проверка

                # --- перенос свежих полей с портала на "хранителя" ---
                if freshest.pk != keeper.pk:
                    for field in mutable_fields:
                        setattr(keeper, field, getattr(freshest, field))
                    if apply_changes:
                        keeper.save()

                # --- переприкрепление PlanShare с доноров на хранителя ---
                for s in donor_shares:
                    reassigned_shares += 1
                    if apply_changes:
                        s.budget_cost = keeper
                        s.save(update_fields=['budget_cost'])

                # --- удаление доноров ---
                donor_ids = [d.pk for d in donors]
                deleted_total += len(donor_ids)
                if apply_changes:
                    BudgetCosts.objects.filter(pk__in=donor_ids).delete()

                resolved += 1

            if not apply_changes:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(
            f"Обработано групп: {resolved}. Переприкреплено PlanShare: {reassigned_shares}. "
            f"Удалено задвоенных записей BudgetCosts: {deleted_total}."
        ))
        if conflicts:
            self.stdout.write(self.style.ERROR(
                f"\nКонфликты (не тронуты, нужна ручная проверка): {len(conflicts)}"))
            for g, share_ids in conflicts[:50]:
                self.stdout.write(
                    f"  plan_item={g['plan_item_id']} year={g['year']} budget_code={g['budget_code']} "
                    f"| у 'хранителя' уже есть PlanShare на то же подразделение, что и у донора "
                    f"(PlanShare id: {share_ids})")
        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                'Это был предварительный прогон. Для реального сохранения запустите с флагом --apply.'))
