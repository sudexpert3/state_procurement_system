from django.db import models


class Supplier(models.Model):
    """Справочник поставщиков и исполнителей Республики Беларусь (Контрагенты)"""
    name = models.CharField("Наименование организации", max_length=512)
    unp = models.CharField("УНП", max_length=16, unique=True, db_index=True)

    class Meta:
        verbose_name = "Поставщик"
        verbose_name_plural = "Справочник поставщиков"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} (УНП: {self.unp})"
