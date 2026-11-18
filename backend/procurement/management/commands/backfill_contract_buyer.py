# -*- coding: utf-8 -*-
"""
Разовая (и повторно запускаемая) чистка: Contract.buyer исторически НИКОГДА не заполнялся
import_reestr26.py — поле на договоре существует отдельно от канонического "закупщика"
позиции плана (PlanItemDetail.buyer, он же колонка "Исполнитель" в rd26.xlsx), и просто не
было подключено к импорту (см. CurrentStatus.md, 2026-11-18 — вопрос фронтенда).

import_reestr26.py (правка 2026-11-18) теперь сам проставляет buyer при СОЗДАНИИ договора —
но только с первой обработанной строки. Эта команда делает более полную сверку: для каждого
договора без buyer смотрит ВСЕХ закупщиков по всем строкам спецификации (через
ContractItem -> PlanShare -> BudgetCosts -> PlanItem -> PlanItemDetail(ACTIVE).buyer) и
заполняет buyer только там, где он один и тот же везде (без конфликта между строками) — иначе
трогать не чем, это требует ручного решения. Безопасно запускать повторно (идемпотентна —
трогает только договоры с buyer=NULL).

Запуск (из backend/):
    python manage.py backfill_contract_buyer             # только отчёт
    python manage.py backfill_contract_buyer --apply      # реально проставляет buyer
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from procurement.models import Contract, PlanItemDetail
from core.choices import PlanItemStatus


class Command(BaseCommand):
    help = 'Проставляет Contract.buyer там, где его можно однозначно вывести из PlanItemDetail.buyer по всем строкам спецификации.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true',
                            help='Реально сохранить. Без флага — только отчёт (dry-run).')

    def handle(self, *args, **options):
        apply_changes = options['apply']
        mode = 'ПРИМЕНЕНО' if apply_changes else 'DRY-RUN (изменения НЕ сохранены)'
        self.stdout.write(f'=== Режим: {mode} ===')

        contracts = Contract.objects.filter(buyer__isnull=True).prefetch_related(
            'items__plan_share__budget_cost__plan_item__details',
        )

        resolved = 0
        conflicting = 0
        no_buyer_anywhere = 0

        for contract in contracts:
            buyers = set()
            for item in contract.items.all():
                plan_item = item.plan_share.budget_cost.plan_item
                detail = plan_item.details.filter(status=PlanItemStatus.ACTIVE).first() \
                    or plan_item.details.order_by('-id').first()
                if detail and detail.buyer_id:
                    buyers.add(detail.buyer_id)

            if not buyers:
                no_buyer_anywhere += 1
                continue
            if len(buyers) > 1:
                conflicting += 1
                self.stdout.write(
                    self.style.WARNING(f'  КОНФЛИКТ договор {contract.number}: закупщики {sorted(buyers)} — пропущен')
                )
                continue

            resolved += 1
            buyer_id = next(iter(buyers))
            if apply_changes:
                Contract.objects.filter(pk=contract.pk).update(buyer_id=buyer_id)

        self.stdout.write(
            f'\nВсего без buyer: {contracts.count()}. Будет проставлено: {resolved}. '
            f'Конфликтов (пропущены): {conflicting}. Нигде нет закупщика: {no_buyer_anywhere}.'
        )

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                'Это был предварительный прогон. Для реального сохранения запустите с флагом --apply.'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Проставлено buyer у {resolved} договоров.'))
