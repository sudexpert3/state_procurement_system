# -*- coding: utf-8 -*-
"""
Разовая починка BudgetCosts, ошибочно заархивированных багами идентичности в
BudgetCostsImportSerializer.create() (см. serializers/budgetCosts.py). Ключ идентичности
`(plan_item, year, budget_code)` поначалу не учитывал ни `economic_code`, ни `functional_code` —
при синхронизации списка `budget_costs` одной позиции (`many=True`, обрабатывается
последовательно) вторая строка с ДРУГИМ `economic_code`/`functional_code` того же
(plan_item, year, budget_code) находила первую как "предыдущую версию той же строки" и
архивировала её, хотя по бизнес-смыслу это отдельная, одновременно действующая строка бюджета:

1. (найден 2026-10-29, CurrentStatus.md Проход 10) многолетняя закупка с разными статьями
   ЭКР (`economic_code`) на разные части закупки в ОДНОМ году — см. answer_fin.txt, Раздел 4.
2. (найден пользователем 2026-11-17 на `2026-102377498-1351`, «Серверное оборудование»)
   ОДНА и та же статья ЭКР может законно относиться к ДВУМ РАЗНЫМ бюджетным параграфам —
   `functional_code` различался ("03 12 00 039" vs "03 12 00 751") при полностью совпадающих
   plan_item/year/budget_code/economic_code.

Оба случая исправлены в serializer'е (соответствующее поле добавлено в ключ идентичности).
Признак испорченной пары: ARCHIVE-запись, у которой есть "живой" близнец — ACTIVE-запись с тем
же (plan_item, year, budget_code), но ДРУГИМ economic_code И/ИЛИ ДРУГИМ functional_code. Эта
команда разово возвращает уже испорченные записи обратно в ACTIVE (не удаляет ничего — status
и так был единственным испорченным полем).

Запуск (из backend/):
    python manage.py reactivate_split_budget_costs             # только отчёт, не трогает БД
    python manage.py reactivate_split_budget_costs --apply      # реально сохраняет изменения
"""
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import OuterRef, Exists, Q

from core.choices import PlanItemStatus
from procurement.models import BudgetCosts


class Command(BaseCommand):
    help = ('Возвращает в ACTIVE записи BudgetCosts, ошибочно заархивированные багами '
            'идентичности в BudgetCostsImportSerializer (см. docstring модуля).')

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true',
                            help='Реально сохранить изменения. Без флага — только отчёт (dry-run).')

    def handle(self, *args, **options):
        apply_changes = options['apply']
        mode = 'ПРИМЕНЕНО' if apply_changes else 'DRY-RUN (изменения НЕ сохранены)'

        # Если у архивной записи уже есть АКТИВНЫЙ двойник с ТОЧНО ТЕМ ЖЕ economic_code и
        # functional_code — это обычная, правильно вытесненная старая версия ТОЙ ЖЕ строки
        # (нормальное версионирование), не баг — такие исключаем сразу, иначе ниже они
        # ложно попадут в кандидаты из-за ДРУГОЙ, не связанной активной строки с тем же
        # (plan_item, year, budget_code) (см. 2019-102377498-237, запись id=8058 — её
        # точный двойник id=11162 уже ACTIVE, но запись всё равно "видела" бы постороннюю
        # активную 8059 с другим economic_code и ложно считалась бы испорченной).
        exact_active_match_exists = BudgetCosts.objects.filter(
            plan_item_id=OuterRef('plan_item_id'),
            year=OuterRef('year'),
            budget_code=OuterRef('budget_code'),
            economic_code=OuterRef('economic_code'),
            functional_code=OuterRef('functional_code'),
            status=PlanItemStatus.ACTIVE,
        )

        # Живой близнец: та же (plan_item, year, budget_code), ACTIVE, но с ДРУГИМ
        # economic_code и/или ДРУГИМ functional_code — любое из двух означает, что архивная
        # запись на самом деле отдельная, одновременно действующая строка бюджета.
        sibling_exists = BudgetCosts.objects.filter(
            plan_item_id=OuterRef('plan_item_id'),
            year=OuterRef('year'),
            budget_code=OuterRef('budget_code'),
            status=PlanItemStatus.ACTIVE,
        ).filter(
            ~Q(economic_code=OuterRef('economic_code')) | ~Q(functional_code=OuterRef('functional_code'))
        )

        candidates = list(
            BudgetCosts.objects.filter(status=PlanItemStatus.ARCHIVE)
            .annotate(has_exact_active_match=Exists(exact_active_match_exists))
            .filter(has_exact_active_match=False)
            .annotate(has_active_sibling=Exists(sibling_exists))
            .filter(has_active_sibling=True)
            .select_related('plan_item')
            .order_by('plan_item_id', 'id')
        )

        # Две (и более) последовательные синхронизации "пинг-понгом" архивировали одну и ту
        # же истинную строку несколько раз подряд (см. 2019-102377498-237/-335 — по ДВЕ
        # архивные записи с ИДЕНТИЧНЫМ functional_code/economic_code/cost). Реактивировать
        # нужно только САМУЮ ПОЗДНЮЮ из них (наибольший id — последний снимок синхронизации),
        # иначе получим ДВЕ одновременно активные записи с одинаковым содержимым. Более
        # ранние дубли внутри той же истинной строки — настоящая история, остаются в архиве.
        groups = defaultdict(list)
        for bc in candidates:
            groups[(bc.plan_item_id, bc.year, bc.budget_code, bc.economic_code, bc.functional_code)].append(bc)

        to_reactivate = []
        to_keep_archived = []
        for group in groups.values():
            group.sort(key=lambda bc: bc.id)
            to_reactivate.append(group[-1])
            to_keep_archived.extend(group[:-1])
        to_reactivate.sort(key=lambda bc: (bc.plan_item_id, bc.id))

        self.stdout.write(f'=== Режим: {mode} ===')
        self.stdout.write(f'Найдено ошибочно заархивированных записей: {len(candidates)}')
        if to_keep_archived:
            self.stdout.write(
                f'  из них дублей той же строки (оставлены в архиве — настоящая история '
                f'повторных синхронизаций): {len(to_keep_archived)}'
            )
            for bc in sorted(to_keep_archived, key=lambda bc: (bc.plan_item_id, bc.id)):
                self.stdout.write(
                    f'    [дубль, не трогаем] plan_item={bc.plan_item.num if bc.plan_item else bc.plan_item_id} | '
                    f'id={bc.id} год={bc.year} functional_code={bc.functional_code!r} '
                    f'economic_code={bc.economic_code!r} cost={bc.cost}'
                )

        with transaction.atomic():
            for bc in to_reactivate:
                self.stdout.write(
                    f'  plan_item={bc.plan_item.num if bc.plan_item else bc.plan_item_id} | '
                    f'id={bc.id} год={bc.year} functional_code={bc.functional_code!r} '
                    f'economic_code={bc.economic_code!r} cost={bc.cost} -> ARCHIVE => ACTIVE'
                )
                if apply_changes:
                    bc.status = PlanItemStatus.ACTIVE
                    bc.save(update_fields=['status', 'changed_at'])

            if not apply_changes:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(f'Реактивировано записей: {len(to_reactivate)}.'))
        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                'Это был предварительный прогон. Для реального сохранения запустите с флагом --apply.'))
