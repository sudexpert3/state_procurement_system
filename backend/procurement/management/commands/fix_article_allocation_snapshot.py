# -*- coding: utf-8 -*-
"""
Разовая правка: до исправления `_approve_article_allocations()` (2026-11-02, см.
CurrentStatus.md) одобрение корректировки лимита архивировало только точные совпадения
по (статья, квартал), оставляя "осиротевшие" ACTIVE-записи от предыдущей (менее точной)
заявки активными одновременно с новыми. Для года 2026 после одобрения исправленной заявки
(построенной по полному разбору листа "T") находит такие осиротевшие записи и архивирует их.

Запуск (из backend/):
    python manage.py fix_article_allocation_snapshot --year 2026             # только отчёт
    python manage.py fix_article_allocation_snapshot --year 2026 --apply      # применить
"""
from django.core.management.base import BaseCommand

from core.choices import ChangeRequestKind, ChangeRequestStatus, PlanItemStatus
from procurement.models import ArticleQuarterlyAllocation, ChangeRequest


class Command(BaseCommand):
    help = 'Архивирует осиротевшие ACTIVE ArticleQuarterlyAllocation, не входящие в последнюю одобренную заявку за год.'

    def add_arguments(self, parser):
        parser.add_argument('--year', type=int, required=True)
        parser.add_argument('--apply', action='store_true',
                            help='Реально сохранить изменения. Без флага — только отчёт (dry-run).')

    def handle(self, *args, **options):
        year = options['year']
        apply_changes = options['apply']
        mode = 'ПРИМЕНЕНО' if apply_changes else 'DRY-RUN (изменения НЕ сохранены)'
        self.stdout.write(f'=== Режим: {mode} ===')

        last_cr = ChangeRequest.objects.filter(
            kind=ChangeRequestKind.BUDGET_LIMIT_CORRECTION, status=ChangeRequestStatus.APPROVED,
            draft_article_allocations__year=year,
        ).order_by('-reviewed_at').first()

        if not last_cr:
            self.stdout.write(self.style.WARNING(f'Нет одобренных корректировок лимита за {year} год.'))
            return

        self.stdout.write(f'Последняя одобренная заявка за {year} год: ChangeRequest id={last_cr.pk} '
                          f'(reviewed_at={last_cr.reviewed_at})')

        keep_pks = list(last_cr.draft_article_allocations.values_list('pk', flat=True))
        stale = ArticleQuarterlyAllocation.objects.filter(
            year=year, status=PlanItemStatus.ACTIVE,
        ).exclude(pk__in=keep_pks).select_related('functional_class', 'economic_class')

        self.stdout.write(f'Осиротевших ACTIVE записей за {year} год: {stale.count()}')
        for row in stale:
            self.stdout.write(
                f'  {row.functional_class.code_api} / {row.economic_class.code_api} / {row.quarter} '
                f'= {row.amount} BYN (change_request_id={row.change_request_id}) -> ARCHIVE'
            )
            if apply_changes:
                row.status = PlanItemStatus.ARCHIVE
                row.save(update_fields=['status', 'changed_at'])

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                'Это был предварительный прогон. Для реального сохранения запустите с флагом --apply.'))
