import os
from django.core.management.base import BaseCommand
from django.db import transaction
import openpyxl
from procurement.models import Supplier


class Command(BaseCommand):
    help = "Импорт реестра поставщиков (РБ и РФ) из файла .xlsx с автоисправлением"

    def add_arguments(self, parser):
        parser.add_argument("file_path", type=str, help="Путь к файлу .xlsx")

    def handle(self, *args, **options):
        file_path = options["file_path"]

        if not os.path.exists(file_path):
            self.stdout.write(self.style.ERROR(f"Файл не найден: {file_path}"))
            return

        try:
            workbook = openpyxl.load_workbook(file_path, data_only=True)
            sheet = workbook.active
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Ошибка чтения Excel: {e}"))
            return

        self.stdout.write(self.style.WARNING("Старт импорта контрагентов (РБ + ВЭД)..."))

        success_count = 0
        updated_count = 0

        with transaction.atomic():
            for row in sheet.iter_rows(min_row=2, max_col=2, values_only=True):
                raw_name = row[0]
                raw_unp = row[1]

                if not raw_name or raw_unp is None:
                    continue

                name = str(raw_name).strip()
                unp = str(raw_unp).strip().split('.')[0]  # Убираем хвосты если зашло как float

                if not unp.isdigit():
                    continue

                # --- ВЕДОМСТВЕННЫЙ АЛГОРИТМ ОЧИСТКИ И АВТОИСПРАВЛЕНИЯ УНП/ИНН ---

                # 1. Если Excel съел ведущий ноль у 9-значного УНП РБ или 10-значного ИНН РФ
                if len(unp) == 8:
                    unp = unp.zfill(9)
                elif len(unp) == 9 and unp.startswith('7'):
                    # Российские ИНН часто начинаются на 7 (Москва, Питер), Excel мог съесть 0 в начале
                    unp = unp.zfill(10)

                # 2. Исправление опечатки ввода (10 знаков, но начинается как УНП РБ на 1, 2, 3, 4, 6, 7)
                # Например: '1903177738' -> это белорусский УНП '190317773' с лишней цифрой на конце
                if len(unp) == 10 and unp[0] in ['1', '2', '3', '4', '6', '7'] and not unp.startswith(
                        '77') and not unp.startswith('78'):
                    self.stdout.write(self.style.WARNING(f"Автоисправление УНП РБ для '{name}': {unp} -> {unp[:9]}"))
                    unp = unp[:9]

                # 3. Валидация длин кодов стран СНГ
                if len(unp) not in [9, 10, 12]:  # 9 - РБ, 10 - Юрлицо РФ, 12 - ИП/Физлицо РФ
                    self.stdout.write(
                        self.style.ERROR(f"Пропущен код {unp} ({name}): недопустимая длина {len(unp)} знаков"))
                    continue

                # Записываем в PostgreSQL
                obj, created = Supplier.objects.update_or_create(
                    unp=unp,
                    defaults={"name": name}
                )

                if created:
                    success_count += 1
                else:
                    updated_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Импорт успешно завершен! Добавлено новых контрагентов: {success_count}, обновлено/перезаписано: {updated_count}"
        ))