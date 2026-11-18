# -*- coding: utf-8 -*-
"""
Разовая чистка дублей ContractQuarterlyFinance, найденных 2026-11-18 (сообщение фронтенда
про карточку позиции плана: две строки "Квартальный план/факт" на один год/квартал — одна с
кодами ЭКР, другая с "—").

Причина (см. docstring _recompute_contract_quarter_actual в
procurement/models/treasuryPayment.py): import_reestr26.py зеркалирует импортные платёжки в
TreasuryPayment (решение 2026-10-30) — сохранение каждой из них триггерило пересчёт "сводной"
(contract_item=None) записи ContractQuarterlyFinance, даже когда для этого же договора/года/
квартала уже была точная запись с разбивкой по строке договора (contract_item). Сигнал уже
исправлен (больше не создаёт и удаляет такую сводную запись сам), но исторические дубли,
накопленные ДО фикса, нужно почистить отдельно.

Удаляются ТОЛЬКО "сводные" (contract_item=None) записи, для которых на тот же
(договор, год, квартал) есть хотя бы одна запись с заполненным contract_item — то есть
исключительно побочный эффект бага, а не легитимные "весь договор без разбивки" записи
(для договоров без ContractItem вообще такая сводная запись остаётся единственным и
правильным представлением, см. Этап 4.3).

Запуск (из backend/):
    python manage.py cleanup_duplicate_contract_quarterly_finance             # только отчёт
    python manage.py cleanup_duplicate_contract_quarterly_finance --apply     # реально удаляет
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Exists, OuterRef, Sum

from procurement.models import ContractQuarterlyFinance


class Command(BaseCommand):
    help = ('Удаляет дублирующиеся "сводные" (contract_item=None) записи '
            'ContractQuarterlyFinance там, где уже есть точная разбивка по contract_item.')

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true',
                            help='Реально удалить. Без флага — только отчёт (dry-run).')

    def handle(self, *args, **options):
        apply_changes = options['apply']
        mode = 'ПРИМЕНЕНО' if apply_changes else 'DRY-RUN (изменения НЕ сохранены)'
        self.stdout.write(f'=== Режим: {mode} ===')

        breakdown_exists = ContractQuarterlyFinance.objects.filter(
            contract_id=OuterRef('contract_id'), quarter=OuterRef('quarter'), year=OuterRef('year'),
            contract_item__isnull=False,
        )
        stale_qs = ContractQuarterlyFinance.objects.filter(
            contract_item__isnull=True,
        ).annotate(has_breakdown=Exists(breakdown_exists)).filter(has_breakdown=True)

        stale = list(stale_qs.select_related('contract').order_by('contract_id', 'year', 'quarter'))
        if not stale:
            self.stdout.write('Дублей не найдено.')
            return

        drifted = 0
        for row in stale:
            totals = ContractQuarterlyFinance.objects.filter(
                contract_id=row.contract_id, quarter=row.quarter, year=row.year, contract_item__isnull=False,
            ).aggregate(p=Sum('planned_cost'), a=Sum('actual_cost'))
            if row.planned_cost != totals['p'] or row.actual_cost != totals['a']:
                drifted += 1
                self.stdout.write(
                    f'  РАСХОЖДЕНИЕ договор {row.contract.number} ({row.year} {row.quarter}): '
                    f'сводная план={row.planned_cost} факт={row.actual_cost}, '
                    f'по строкам сумма план={totals["p"]} факт={totals["a"]}'
                )

        self.stdout.write(
            f'\nВсего дублей: {len(stale)} (договоров: {len({r.contract_id for r in stale})}), '
            f'из них с расхождением сумм: {drifted}.'
        )

        if apply_changes:
            with transaction.atomic():
                ids = [r.pk for r in stale]
                ContractQuarterlyFinance.objects.filter(pk__in=ids).delete()
            self.stdout.write(self.style.SUCCESS(f'Удалено {len(stale)} дублирующихся записей.'))
        else:
            self.stdout.write(self.style.WARNING(
                'Это был предварительный прогон. Для реального удаления запустите с флагом --apply.'))
