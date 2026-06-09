from django.db import models


class FunctionalCode(models.Model):
    """
    Ведомственный справочник функциональной классификации Минфина РБ.
    Сюда входят Разделы, Подразделы, Виды и Параграфы (например, § 851 Витебск).
    """
    code_api = models.CharField("Код в формате API (например, '3 12 0 851')", max_length=64, unique=True, db_index=True)
    description = models.CharField("Наименование объекта/цели (например, '03_12_00 § 851 (Витебск 3)')", max_length=255, blank=True, null=True)
    is_active = models.BooleanField("Действующий код", default=True)

    class Meta:
        verbose_name = "Код функциональной классификации"
        verbose_name_plural = "Справочник функциональных кодов"
        ordering = ["code_api"]

    def __str__(self):
        if self.description:
            return f"{self.code_api} — {self.description}"
        return self.code_api
