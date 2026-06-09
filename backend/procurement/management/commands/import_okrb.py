import os
from django.core.management.base import BaseCommand
from django.db import transaction
import openpyxl
from procurement.models.okrb import OkrbProduct


class Command(BaseCommand):
    help = "Импорт концевых 9-значных кодов ОКРБ 007 из современного файла .xlsx"

    def add_arguments(self, parser):
        parser.add_argument(
            "file_path", type=str, help="Путь к файлу .xlsx с классификатором"
        )

    def handle(self, *args, **options):
        file_path = options["file_path"]

        if not os.path.exists(file_path):
            self.stdout.write(
                self.style.ERROR(f"Файл не найден по пути: {file_path}")
            )
            return

        self.stdout.write(
            self.style.WARNING(f"Открытие файла XLSX: {file_path}...")
        )

        try:
            # Загружаем книгу Excel в режиме чтения значений (data_only=True)
            workbook = openpyxl.load_workbook(file_path, data_only=True)
            sheet = workbook.active
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"Ошибка при чтении XLSX файла: {e}")
            )
            return

        self.stdout.write(
            self.style.WARNING("Запуск транзакции импорта ОКРБ 007...")
        )

        success_count = 0
        skipped_count = 0

        # Открываем атомарную транзакцию СУБД для максимальной скорости записи тысяч строк
        with transaction.atomic():
            # Построчно читаем Excel (Колонка А - Код, Колонка B - Наименование)
            for row in sheet.iter_rows(
                min_row=1, max_col=3, values_only=True
            ):
                print(row)
                raw_code = row[1]
                raw_title = row[2]

                # Пропускаем пустые ячейки
                if raw_code is None or raw_title is None:
                    continue

                code = str(raw_code).strip()
                title = str(raw_title).strip()

                # --- ВЕДОМСТВЕННЫЙ ФИЛЬТР СТРУКТУРЫ ОКРБ 007 РБ ---
                # Удаляем точки для подсчета чистых цифровых знаков кодировки Минфина
                clean_digits = code.replace(".", "")

                # Строгая проверка: код должен состоять только из цифр и иметь длину ровно 9 знаков
                # Пример: '01.11.11.100' -> clean_digits = '011111100' (длина 9) -> ПРИНИМАЕМ
                # Пример: '01.11.20'     -> clean_digits = '011120'    (длина 6) -> ПРОПУСКАЕМ
                if clean_digits.isdigit() and len(clean_digits) == 9:
                    # Сохраняем или обновляем запись в PostgreSQL
                    OkrbProduct.objects.update_or_create(
                        code=code, defaults={"title": title, "is_active": True}
                    )
                    success_count += 1
                else:
                    # Пропускаем агрегирующие группы (классы, подклассы)
                    skipped_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Импорт ОКРБ 007 успешно завершен!\n"
                f"Добавлено/обновлено концевых кодов продукции: {success_count}\n"
                f"Пропущено укрупненных ведомственных групп: {skipped_count}"
            )
        )
