from django.db import models


class InternalEconomicClassifier(models.Model):
    """
    Единый иерархический справочник кодов ЭКР Республики Беларусь с расшифровкой.
    """
    code = models.CharField("Код ЭКР (например, 1101008165)", max_length=32, unique=True, db_index=True)
    name = models.TextField("Наименование (расшифровка кода)")
    # Рекурсивная связь для построения дерева кодов Минфина РБ
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='sub_codes', verbose_name="Вышестоящая статья/группа")
    is_active = models.BooleanField("Действующий код", default=True)

    class Meta:
        verbose_name = "Код ЭКР (внутренний ГКСЭ)"
        verbose_name_plural = "Справочник кодов ЭКР (внутренний ГКСЭ)"
        ordering = ['code']

    def __str__(self):
        if self.name:
            return f"{self.code} - {self.name}"
        return f"{self.code}"