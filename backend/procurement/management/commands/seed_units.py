from django.core.management.base import BaseCommand
from django.db import transaction
from procurement.models.unitOfMeasurement import UnitOfMeasurement


class Command(BaseCommand):
    help = "Автоматическое первичное наполнение справочника единиц измерения ОКРБ 008"

    def handle(self, *args, **options):
        # Массив данных на основе вашего TextChoices
        units_data = [
            ("0006", "MTR", "м"),
            ("0018", "LM", "пог.м"),
            ("0055", "MTK", "м2"),
            ("0112", "LTR", "л"),
            ("0113", "MTQ", "м3"),
            ("0116", "A44", "дал"),
            ("0163", "GRM", "г"),
            ("0166", "KGM", "кг"),
            ("0231", "MLT", "мл"),
            ("0233", "GGAL", "Гкал"),
            ("0245", "KWH", "кВт·ч"),
            ("0625", "LEF", "лист."),
            ("0642", "C62", "ед."),
            ("0704", "SET", "набор"),
            ("0715", "PR", "пар"),
            ("0728", "RM", "пач."),
            ("0736", "NRL", "рул."),
            ("0778", "NMP", "упак."),
            ("0796", "H87", "шт."),
            ("0839", "KT", "компл."),
            ("0868", "Bo", "бут"),
            ("0870", "_AMP", "ампул."),
            ("0876", "_UE", "усл. ед."),
        ]

        self.stdout.write(
            self.style.WARNING("Запуск наполнения единиц измерения...")
        )

        success_count = 0

        with transaction.atomic():
            for code_api, code_alpha, short_name in units_data:
                obj, created = UnitOfMeasurement.objects.update_or_create(
                    code_api=code_api,
                    defaults={"short_name": short_name},
                )
                if created:
                    success_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Справочник ОКРБ 008 успешно заполнен! Добавлено записей: {success_count}"
            )
        )
