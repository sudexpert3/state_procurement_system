# -*- coding: utf-8 -*-
"""
Синхронизирует PlanItem/PlanItemDetail/BudgetCosts из JSON-файла, выгруженного командой
export_goszakupki_plan (на машине, у которой ЕСТЬ доступ к api.goszakupki.by — из этого
окружения прямой доступ к порталу недоступен, см. CurrentStatus.md).

Запуск (из backend/):
    python manage.py sync_goszakupki_from_file 68009 ../input/api_plan_68009.json
    python manage.py sync_goszakupki_from_file 59258 ../input/api_plan_59258.json

Если для purchase_id ещё нет строки Purchases — передайте --year, она будет создана.
"""
import json

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from procurement.models import Purchases
from procurement.services.goszakupki_sync import sync_plan_items_from_data


class Command(BaseCommand):
    help = 'Синхронизирует план закупок из офлайн JSON-файла (см. export_goszakupki_plan).'

    def add_arguments(self, parser):
        parser.add_argument('purchase_id', type=int, help='ID годового плана на портале (напр. 68009, 59258)')
        parser.add_argument('file', type=str, help='Путь к JSON-файлу, выгруженному export_goszakupki_plan')
        parser.add_argument('--year', type=int, default=None,
                            help='Год плана — нужен только если для purchase_id ещё нет строки Purchases')
        parser.add_argument('--apply', action='store_true',
                            help='Реально сохранить изменения. Без флага — только отчёт (dry-run).')

    def handle(self, *args, **options):
        purchase_id = options['purchase_id']
        file_path = options['file']
        year = options['year']
        apply_changes = options['apply']

        try:
            with open(file_path, encoding='utf-8') as f:
                result_data = json.load(f)
        except FileNotFoundError:
            raise CommandError(f'Файл не найден: {file_path}')
        except json.JSONDecodeError as exc:
            raise CommandError(f'Файл {file_path} — не валидный JSON: {exc}')

        if not isinstance(result_data, list):
            raise CommandError(f'Ожидался список позиций плана (JSON-массив), получено: {type(result_data).__name__}')

        mode = 'ПРИМЕНЕНО' if apply_changes else 'DRY-RUN (изменения НЕ сохранены)'

        with transaction.atomic():
            purchase_master = Purchases.objects.filter(purchase_id=purchase_id).first()
            if not purchase_master:
                if not year:
                    raise CommandError(
                        f'Purchases с purchase_id={purchase_id} не найден в БД. '
                        f'Укажите --year, чтобы создать новую строку плана.'
                    )
                purchase_master = Purchases.objects.create(
                    purchase_id=purchase_id, year=year, purchase_num=f'{year}-102377498',
                )
                self.stdout.write(f'Создан Purchases(purchase_id={purchase_id}, year={year})')

            self.stdout.write(f'=== Режим: {mode} ===')
            self.stdout.write(f'Синхронизирую {len(result_data)} позиций из {file_path} '
                              f'(план "{purchase_master.purchase_num}", {purchase_master.year} год) ...')

            stats = sync_plan_items_from_data(purchase_master, result_data, log=self.stdout.write)

            if not apply_changes:
                transaction.set_rollback(True)

        self.stdout.write(self.style.SUCCESS(
            f"Готово ({mode}). Позиций плана: импортировано {stats['imported']}, обновлено {stats['updated']}, "
            f"пропущено (нет id/num) {stats['skipped']}.\n"
            f"BudgetCosts: импортировано {stats['budget_imported']}, обновлено {stats['budget_updated']}.\n"
            f"Заархивировано (пропали с портала): {stats['archived']}."
        ))
        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                'Это был предварительный прогон. Для реального сохранения запустите с флагом --apply.'))
