# -*- coding: utf-8 -*-
"""
Разбор файла fin_2026.xlsb от Казначейства (лист "ЦА") и создание заявки на корректировку
квартальных лимитов статей (Этап 3.4). Только СОЗДАЁТ черновик (ChangeRequest.status=DRAFT) —
отправка на проверку и одобрение/отклонение делается отдельно специалистом/финансистом через
API (POST /api/change_requests/{id}/submit|approve|reject/), эта команда не вызывает их сама.

Запуск (из backend/):
    python manage.py parse_fin_file --year 2026                       # только отчёт
    python manage.py parse_fin_file --year 2026 --apply                # создать черновик заявки
    python manage.py parse_fin_file --year 2026 --file path.xlsb       # другой файл
"""
from django.core.management.base import BaseCommand

from procurement.services.fin_file_parser import parse_fin_file
from procurement.services import change_requests as cr_service


class Command(BaseCommand):
    help = 'Разбирает fin_2026.xlsb (лист "ЦА") и создаёт черновик заявки на корректировку лимитов (Этап 3.4).'

    def add_arguments(self, parser):
        parser.add_argument('--file', type=str, default='input/fin_2026.xlsb',
                            help='Путь к файлу (по умолчанию input/fin_2026.xlsb от корня репозитория)')
        parser.add_argument('--year', type=int, required=True, help='Год, на который действуют лимиты')
        parser.add_argument('--reason', type=str, default=None,
                            help='Обоснование заявки (по умолчанию — имя файла)')
        parser.add_argument('--apply', action='store_true',
                            help='Реально создать черновик заявки. Без флага — только отчёт (dry-run).')

    def handle(self, *args, **options):
        file_path = options['file']
        year = options['year']
        apply_changes = options['apply']
        reason = options['reason'] or f'Разбор {file_path} (Казначейство), {year} год'

        self.stdout.write(f'Открываю {file_path} ...')
        lines, report = parse_fin_file(file_path, year)

        mode = 'ПРИМЕНЕНО' if apply_changes else 'DRY-RUN (изменения НЕ сохранены)'
        self.stdout.write(self.style.WARNING(f'\n=== Режим: {mode} ==='))
        self.stdout.write(f"Строк-статей обработано: {report['rows_total']}")
        self.stdout.write(f"Сопоставлено со справочниками: {report['matched_articles']}")
        self.stdout.write(f"Исключено по правилу (не учитывается и в rd26): {len(report['excluded'])}")
        self.stdout.write(self.style.WARNING(
            f"Функциональный код не найден в справочнике: {len(report['functional_not_found'])}"))
        for code in sorted(report['functional_not_found']):
            self.stdout.write(f'  {code}')
        self.stdout.write(self.style.WARNING(
            f"Код статьи ЭКР не найден в справочнике: {len(report['economic_not_found'])}"))
        for code in sorted(report['economic_not_found']):
            self.stdout.write(f'  {code}')
        self.stdout.write(f'Строк для заявки (статья x квартал): {len(lines)}')

        if not lines:
            self.stdout.write(self.style.WARNING('Нет строк для создания заявки — выхожу.'))
            return

        if apply_changes:
            change_request = cr_service.create_budget_limit_correction(lines, reason=reason)
            self.stdout.write(self.style.SUCCESS(
                f'Создан черновик заявки ChangeRequest id={change_request.pk} '
                f'(kind=BUDGET_LIMIT_CORRECTION, status=DRAFT). '
                f'Для отправки на проверку: POST /api/change_requests/{change_request.pk}/submit/'
            ))
        else:
            self.stdout.write(self.style.WARNING(
                '\nЭто был предварительный прогон. Для реального создания черновика заявки '
                'запустите с флагом --apply.'))
