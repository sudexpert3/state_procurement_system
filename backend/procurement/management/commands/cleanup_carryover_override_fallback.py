# -*- coding: utf-8 -*-
"""
Разовая чистка артефактов, созданных СЕГОДНЯ (2026-10-29) в этой же сессии, а не реальной
бизнес-историей: до того как для строк 1281/1282 реестра (answer_fin.txt, Раздел 1) был
добавлен точечный override в CARRYOVER_OVERRIDES (import_reestr26.py), не находя уверенного
совпадения, скрипт создавал "якорные" непубликуемые позиции `2025-INTERNAL-00004/00005` со
своими PlanShare/ContractItem/ContractQuarterlyFinance на ТЕ ЖЕ договоры ("01/11-спэс",
"01-11/2023"), что и правильные позиции `2023-102377498-1835/1837` (план 2023 года
синхронизирован позже тем же днём). После добавления override повторный импорт создал ВТОРОЙ,
правильный комплект ContractItem/ContractQuarterlyFinance на эти же договоры — старый
("якорный") комплект осиротел, но физически остался в БД, из-за чего Contract.total_cost
задвоился (сумма двух ContractItem на один договор).

Это НЕ случай "архивировать, сохранив историю" (как PlanItemDetail/BudgetCosts при
пересмотре портала) — объекты созданы и устарели в рамках одного дня одной сессии, реальной
бизнес-истории не несут. Поэтому удаляются, а не архивируются (в правильном порядке — модели
используют on_delete=PROTECT).

Запуск (из backend/):
    python manage.py cleanup_carryover_override_fallback             # только отчёт
    python manage.py cleanup_carryover_override_fallback --apply      # реально удаляет
"""
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from procurement.models import PlanItem, Contract

STALE_PLAN_ITEM_NUMS = ['2025-INTERNAL-00004', '2025-INTERNAL-00005']


class Command(BaseCommand):
    help = 'Удаляет осиротевшие "якорные" позиции/договорные строки, созданные до override для 1281/1282 (см. docstring).'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true',
                            help='Реально удалить. Без флага — только отчёт (dry-run).')

    def handle(self, *args, **options):
        apply_changes = options['apply']
        mode = 'ПРИМЕНЕНО' if apply_changes else 'DRY-RUN (изменения НЕ сохранены)'
        self.stdout.write(f'=== Режим: {mode} ===')

        plan_items = list(PlanItem.objects.filter(num__in=STALE_PLAN_ITEM_NUMS))
        if not plan_items:
            self.stdout.write('Ничего не найдено (уже удалено или num изменился).')
            return

        touched_contract_ids = set()

        with transaction.atomic():
            for pi in plan_items:
                budget_costs = list(pi.budget_costs.all())
                plan_shares = []
                for bc in budget_costs:
                    plan_shares.extend(bc.plan_shares.all())
                contract_items = []
                for ps in plan_shares:
                    contract_items.extend(ps.contract_items.all())

                self.stdout.write(
                    f'  {pi.num}: BudgetCosts={len(budget_costs)}, PlanShare={len(plan_shares)}, '
                    f'ContractItem={len(contract_items)}'
                )
                for ci in contract_items:
                    touched_contract_ids.add(ci.contract_id)
                    self.stdout.write(
                        f'    -> ContractItem id={ci.id} contract={ci.contract.number} '
                        f'contract_cost={ci.contract_cost}'
                    )
                    if apply_changes:
                        ci.quarterly_finances.all().delete()
                        ci.delete()
                for ps in plan_shares:
                    if apply_changes:
                        ps.delete()
                for bc in budget_costs:
                    if apply_changes:
                        bc.delete()
                if apply_changes:
                    pi.details.all().delete()
                    pi.delete()

            if touched_contract_ids:
                self.stdout.write('\nПересчёт Contract.total_cost по затронутым договорам:')
                for contract in Contract.objects.filter(pk__in=touched_contract_ids):
                    new_total = sum((ci.contract_cost for ci in contract.items.all()), Decimal('0'))
                    self.stdout.write(f'  {contract.number}: {contract.total_cost} -> {new_total}')
                    if apply_changes:
                        Contract.objects.filter(pk=contract.pk).update(total_cost=new_total)

            if not apply_changes:
                transaction.set_rollback(True)

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                'Это был предварительный прогон. Для реального удаления запустите с флагом --apply.'))
