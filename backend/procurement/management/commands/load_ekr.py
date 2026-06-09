# backend/procurement/management/commands/import_ekr_excel.py
import os
from django.core.management.base import BaseCommand
from django.db import transaction
import openpyxl
from procurement.models import EconomicClassifier


class Command(BaseCommand):
    help = "Импорт справочника ЭКР РБ из файла .xlsx с автоматическим построением иерархии"

    def add_arguments(self, parser):
        parser.add_argument(
            "file_path", type=str, help="Путь к файлу .xlsx для импорта"
        )

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

        self.stdout.write(self.style.WARNING("Старт импорта ЭКР РБ..."))

        with transaction.atomic():
            success_count = 0

            # Предзаполняем ТОЛЬКО самые верхние Разделы (маска X000000)
            # Все остальные промежуточные уровни (1100000, 1100300) скрипт создаст
            # и свяжет САМ, когда дойдет до них в вашем Excel файле.
            root_codes = [
                ("1000000", "ТЕКУЩИЕ РАСХОДЫ"),
                ("2000000", "КАПИТАЛЬНЫЕ РАСХОДЫ"),
            ]
            for code, name in root_codes:
                EconomicClassifier.objects.get_or_create(code=code, defaults={"name": name})

            # Читаем строки Excel
            for row in sheet.iter_rows(min_row=1, max_col=2, values_only=True):
                if not row[0] or not row[1]:
                    continue

                code = str(row[0]).strip()
                name = str(row[1]).strip()

                if not code.isdigit():
                    continue

                parent_obj = None

                # --- СТРОГАЯ СИСТЕМНАЯ МЕТОДОЛОГИЯ МИНФИНА РБ ---
                if len(code) == 7:
                    if code.endswith("00000"):  # Это Подраздел (например, 1100000)
                        parent_code = code[0] + "000000"  # Родителем будет Раздел (1000000)
                    elif code.endswith("00"):  # Это Подгруппа (например, 1100300)
                        parent_code = code[:2] + "00000"  # Родителем будет Подраздел (1100000)
                    else:  # Это Статья (например, 1100303)
                        parent_code = code[:5] + "00"  # Родителем будет Подгруппа (1100300)

                    parent_obj = EconomicClassifier.objects.filter(code=parent_code).first()

                elif len(code) == 10:  # Это Концевой элемент (например, 1100303022)
                    parent_code = code[:7]  # Родителем ВСЕГДА будет Статья (1100303)
                    parent_obj = EconomicClassifier.objects.filter(code=parent_code).first()

                # Сохраняем/обновляем запись с правильным parent
                EconomicClassifier.objects.update_or_create(
                    code=code,
                    defaults={"name": name, "parent": parent_obj}
                )
                success_count += 1

        self.stdout.write(self.style.SUCCESS(f"Успешно импортировано строк: {success_count}"))
