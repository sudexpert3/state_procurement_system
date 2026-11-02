# -*- coding: utf-8 -*-
"""
Разовая починка BudgetCosts, ошибочно заархивированных багом в
BudgetCostsImportSerializer.create() (найден 2026-10-29, см. serializers/budgetCosts.py и
CurrentStatus.md, Проход 10): ключ идентичности `(plan_item, year, budget_code)` не учитывал
`economic_code` — при синхронизации списка `budget_costs` одной позиции (`many=True`,
обрабатывается последовательно) вторая строка с ДРУГИМ `economic_code` того же
(plan_item, year, budget_code) находила первую как "предыдущую версию той же строки" и
архивировала её, хотя по бизнес-смыслу это отдельная, одновременно действующая строка бюджета
(многолетняя закупка с разными статьями ЭКР на разные части закупки — подтверждено пользователем
и данными БД, см. answer_fin.txt, Раздел 4).

Признак испорченной пары: ARCHIVE-запись, у которой есть "живой" близнец — ACTIVE-запись с тем
же (plan_item, year, budget_code), но ДРУГИМ economic_code. Баг сам по себе уже исправлен в
serializer'е — эта команда разово возвращает уже испорченные записи обратно в ACTIVE (не удаляет
ничего — status и так был единственным испорченным полем).

Запуск (из backend/):
    python manage.py reactivate_split_budget_costs             # только отчёт, не трогает БД
    python manage.py reactivate_split_budget_costs --apply      # реально сохраняет изменения
"""
from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import F, OuterRef, Exists

from core.choices import PlanItemStatus
from procurement.models import BudgetCosts


class Command(BaseCommand):
    help = ('Возвращает в ACTIVE записи BudgetCosts, ошибочно заархивированные багом '
            'идентичности в BudgetCostsImportSerializer (см. docstring модуля).')

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true',
                            help='Реально сохранить изменения. Без флага — только отчёт (dry-run).')

    def handle(self, *args, **options):
        apply_changes = options['apply']
        mode = 'ПРИМЕНЕНО' if apply_changes else 'DRY-RUN (изменения НЕ сохранены)'

        # Живой близнец: та же (plan_item, year, budget_code), другой economic_code, ACTIVE.
        sibling_exists = BudgetCosts.objects.filter(
            plan_item_id=OuterRef('plan_item_id'),
            year=OuterRef('year'),
            budget_code=OuterRef('budget_code'),
            status=PlanItemStatus.ACTIVE,
        ).exclude(economic_code=OuterRef('economic_code'))

        candidates = list(
            BudgetCosts.objects.filter(status=PlanItemStatus.ARCHIVE)
            .annotate(has_active_sibling=Exists(sibling_exists))
            .filter(has_active_sibling=True)
            .select_related('plan_item')
            .order_by('plan_item_id', 'id')
        )

        self.stdout.write(f'=== Режим: {mode} ===')
        self.stdout.write(f'Найдено ошибочно заархивированных записей: {len(candidates)}')

        with transaction.atomic():
            for bc in candidates:
                self.stdout.write(
                    f'  plan_item={bc.plan_item.num if bc.plan_item else bc.plan_item_id} | '
                    f'id={bc.id} год={bc.year} economic_code={bc.economic_code!r} cost={bc.cost} '
                    f'-> ARCHIVE => ACTIVE'
                )
                if apply_changes:
                    bc.status = PlanItemStatus.ACTIVE
                    bc.save(update_fields=['status', 'changed_at'])

            if not apply_changes:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(f'Реактивировано записей: {len(candidates)}.'))
        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                'Это был предварительный прогон. Для реального сохранения запустите с флагом --apply.'))
