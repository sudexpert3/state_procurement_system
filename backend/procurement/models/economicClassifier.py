from django.db import models


class EconomicClassifier(models.Model):
    """
    Единый иерархический справочник кодов ЭКР Республики Беларусь с расшифровкой.
    """
    code = models.CharField("Код ЭКР (например, 1101008165)", max_length=32, unique=True, db_index=True)
    name = models.TextField("Наименование (расшифровка кода)")
    # Рекурсивная связь для построения дерева кодов Минфина РБ
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sub_codes',
        verbose_name="Вышестоящая статья/группа"
    )

    class Meta:
        verbose_name = "Код ЭКР (Справочник)"
        verbose_name_plural = "Справочник кодов ЭКР"
        ordering = ['code']

    def __str__(self):
        return f"{self.code} — {self.name[:60]}"
