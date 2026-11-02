# -*- coding: utf-8 -*-
"""
Разовая починка 2 позиций плана, где держатель лимита (колонка V реестра) сменился между
версиями rd26.xlsx, а старый PlanShare остался висеть в БД (импортёр только добавляет
PlanShare, не снимает его при смене держателя — см. CurrentStatus.md, Проход 10,
"побочная находка"). По решению пользователя 2026-10-29: перенос данных из Excel —
одноразовая миграция перед вводом в промышленную эксплуатацию (дальше синхронизация будет
только по схеме наша система <-> goszakupki.by), поэтому это НЕ архитектурный фикс
импортёра на будущее, а разовая точечная правка конкретных записей.

Архивирует старый PlanShare (неверный/устаревший держатель), чтобы при повторном
import_reestr26 --apply для этой позиции создался новый PlanShare с держателем из текущего
файла. Контрактов/квартального финансирования на архивируемые записи не привязано
(проверено в БД — ContractItem.plan_share на них не ссылается).

Запуск (из backend/):
    python manage.py fix_dept_holder_reassignment             # только отчёт
    python manage.py fix_dept_holder_reassignment --apply      # реально сохраняет изменения
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from core.choices import PlanItemStatus
from procurement.models import PlanShare

# (plan_item.num, id старого PlanShare с устаревшим держателем лимита) — найдено при
# разборе answer_fin.txt / контрольного прогона import_reestr26, 2026-10-29.
STALE_PLAN_SHARE_IDS = {
    '2026-102377498-1492': 1521,  # держатель был "ООиОЗ", в текущем файле — "ГУФиТ"
    '2026-102377498-1512': 1541,  # аналогично
}


class Command(BaseCommand):
    help = 'Архивирует устаревшие PlanShare для позиций со сменившимся держателем лимита (см. docstring).'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true',
                            help='Реально сохранить изменения. Без флага — только отчёт (dry-run).')

    def handle(self, *args, **options):
        apply_changes = options['apply']
        mode = 'ПРИМЕНЕНО' if apply_changes else 'DRY-RUN (изменения НЕ сохранены)'
        self.stdout.write(f'=== Режим: {mode} ===')

        with transaction.atomic():
            for num, ps_id in STALE_PLAN_SHARE_IDS.items():
                ps = PlanShare.objects.filter(id=ps_id).select_related('department', 'budget_cost').first()
                if not ps:
                    self.stdout.write(self.style.WARNING(f'  {num}: PlanShare id={ps_id} не найден, пропуск'))
                    continue
                self.stdout.write(
                    f'  {num} | PlanShare id={ps.id} держатель={ps.department.short_name} '
                    f'статус={ps.status} -> ARCHIVE'
                )
                if apply_changes:
                    ps.status = PlanItemStatus.ARCHIVE
                    ps.save(update_fields=['status'])

            if not apply_changes:
                transaction.set_rollback(True)

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                'Это был предварительный прогон. Для реального сохранения запустите с флагом --apply. '
                'После этого запустите import_reestr26 --apply ещё раз, чтобы создать PlanShare с '
                'держателем лимита из текущего файла.'))
