from django.db import models


class Department(models.Model):
    full_name = models.CharField("Полное наименование подразделения", max_length=512, unique=True)
    short_name = models.CharField("Краткое наименование подразделения", max_length=16, unique=True)
    is_active = models.BooleanField("Действующее подразделение", default=True)

    # Рекурсивная связь для построения древовидной структуры ведомства
    parent = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='sub_departments',
        verbose_name="Вышестоящее подразделение (Агрегатор)"
    )

    class Meta:
        verbose_name = "Подразделение"
        verbose_name_plural = "Подразделения"
        ordering = ["short_name"]

    def __str__(self):
        if self.parent:
            return f"{self.parent.short_name} -> {self.short_name}"
        return self.short_name

    @property
    def is_root(self):
        """Проверка, является ли подразделение верхнеуровневым (например, ГУСМЭ)"""
        return self.parent is None
