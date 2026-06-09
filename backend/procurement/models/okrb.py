from django.db import models


class OkrbProduct(models.Model):
    """
    Общереспубликанский классификатор ОКРБ 007-2012 «Продукция по видам экономической деятельности».
    Используется для автоподстановки кодов и наименований при ручном создании пунктов ГПЗ.
    """
    code = models.CharField(
        "Код ОКРБ 007 (например, 62.01.11.900)",
        max_length=32,
        unique=True,
        db_index=True,
    )
    title = models.TextField("Наименование группировки/вида продукции")
    is_active = models.BooleanField("Актуальный код", default=True)

    class Meta:
        verbose_name = "Код ОКРБ 007"
        verbose_name_plural = "Справочник ОКРБ 007"
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} — {self.title[:60]}"
