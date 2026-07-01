from django.db import models


class ExternalEconomicCode(models.Model):
    """
    Справочник соответствия внешних кодов ЭКР (с пробелами из API)
    внутренним статьям иерархического классификатора ГКСЭ.
    """
    code_api = models.CharField("Код в формате API (например, '1 10 10 99')", max_length=64, unique=True, db_index=True)
    description = models.TextField("Наименование статьи (например, '1.10.06.00 Оплата услуг связи')")
    is_active = models.BooleanField("Действующий код", default=True)

    class Meta:
        verbose_name = "Код ЭКР (goszakupki.by)"
        verbose_name_plural = "Справочник кодов ЭКР (goszakupki.by)"
        ordering = ["code_api"]

    def __str__(self):
        if self.description:
            return f"{self.code_api} - {self.description}"
        return f"{self.code_api}"
