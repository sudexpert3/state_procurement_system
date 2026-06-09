from django.db import models


class ProgramCode(models.Model):
    """
    Ведомственный справочник программной классификации Минфина РБ.
    Хранит коды программ и подпрограмм (например, "99 0" - Основная, "19 1" - Указ 119).
    """
    code_api = models.CharField("Код в формате API (например, '99 0')", max_length=32, unique=True, db_index=True)
    description = models.CharField("Официальный вид (например, '99_00' или '19_01') и наименование", max_length=255, blank=True, null=True)
    is_active = models.BooleanField("Действующая программа", default=True)

    class Meta:
        verbose_name = "Код программной классификации"
        verbose_name_plural = "Справочник программных кодов"
        ordering = ["code_api"]

    def __str__(self):
        if self.description:
            return f"{self.code_api} — {self.description}"
        return self.code_api
