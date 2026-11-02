from django.db import models


class Supplier(models.Model):
    """Справочник поставщиков и исполнителей Республики Беларусь (Контрагенты)"""
    name = models.CharField("Наименование организации", max_length=512)
    # null=True (не blank=True без null) — позволяет хранить несколько поставщиков без УНП:
    # в rd26.xlsx поставщик указан только названием, УНП специалист дозаполняет вручную позже.
    # NULL в PostgreSQL не конфликтует с unique=True (в отличие от пустой строки).
    unp = models.CharField("УНП", max_length=16, unique=True, db_index=True, null=True, blank=True)

    class Meta:
        verbose_name = "Поставщик"
        verbose_name_plural = "Справочник поставщиков"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} (УНП: {self.unp})"
