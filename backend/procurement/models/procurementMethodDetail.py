from django.core.exceptions import ValidationError
from django.db import models


class ProcurementMethodDetail(models.Model):
    """Справочник видов процедур закупок РБ с детализацией по пунктам нормативных актов"""
    name = models.CharField("Наименование процедуры / пункта", max_length=512, help_text="Например: 'ОИ по пункту 26 (Коммунальные услуги)' или 'Электронный аукцион'")

    # Рекурсивная связь: пункт (дочерний элемент) ссылается на базовый метод закупки (родительский элемент)
    parent = models.ForeignKey('self', on_delete=models.PROTECT, null=True, blank=True, related_name='sub_methods', verbose_name="Родительский метод закупки",
        help_text="Оставьте пустым, если это верхнеуровневый метод (например, просто 'Закупка из одного источника')"
    )
    is_active = models.BooleanField("Актуальный метод", default=True)

    class Meta:
        verbose_name = "Детализация процедуры закупки"
        verbose_name_plural = "Справочник процедур закупок (с пунктами)"
        ordering = ['parent_id', 'name']

    def __str__(self):
        if self.parent:
            return f"{self.parent.name} -> {self.name}"
        return self.name

    def clean(self):
        super().clean()
        if self.parent_id and self.pk and self.parent_id == self.pk:
            raise ValidationError({
                'parent': "Пункт процедуры не может ссылаться на самого себя."
            })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
