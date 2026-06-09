from django.db import models


class UnitOfMeasurement(models.Model):
    """
    Общереспубликанский классификатор ОКРБ 008-95 «Единицы измерения и счетные единицы».
    Используется для интеграции с API goszakupki.by и вывода в рабочих планах.
    """
    code = models.CharField("Код в формате API (например, '0642')", max_length=8, unique=True, db_index=True)
    short_name = models.CharField("Краткое наименование (например, 'шт.', 'ед.')", max_length=32)
    is_active = models.BooleanField("Актуальный код", default=True)

    class Meta:
        verbose_name = "Единица измерения (ОКРБ 008)"
        verbose_name_plural = "Справочник единиц измерения"
        ordering = ["short_name"]

    def __str__(self):
        return f"{self.code} ({self.short_name})"
