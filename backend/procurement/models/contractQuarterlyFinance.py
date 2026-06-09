from django.core.exceptions import ValidationError
from django.db import models

from .contract import Contract


class QuarterTypes(models.TextChoices):
    Q1 = 'Q1', 'I Квартал'
    Q2 = 'Q2', 'II Квартал'
    Q3 = 'Q3', 'III Квартал'
    Q4 = 'Q4', 'IV Квартал'


class ContractQuarterlyFinance(models.Model):
    """Квартальное казначейское планирование и кассовое исполнение договора"""
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='quarterly_finances', verbose_name="Договор")
    quarter = models.CharField("Квартал", max_length=2, choices=QuarterTypes.choices, db_index=True)
    year = models.PositiveIntegerField("Год", db_index=True)

    planned_cost = models.DecimalField("Прогнозируемый (планируемый) расход", max_digits=15, decimal_places=2, default=0)
    actual_cost = models.DecimalField("Фактический расход (по платежным поручениям)", max_digits=15, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Квартальное финансирование договора"
        verbose_name_plural = "Квартальное финансирование договоров"
        constraints = [
            # В рамках одного договора, года и квартала может быть только одна управляющая строка
            models.UniqueConstraint(
                fields=['contract', 'quarter', 'year'],
                name='unique_contract_quarter_per_year'
            )
        ]
        ordering = ['year', 'quarter']

    def __str__(self):
        return f"Договор № {self.contract.number} — {self.get_quarter_display()} {self.year} г."

    def clean(self):
        super().clean()

        # Валидация: факт не может быть больше, чем весь объем договора
        if self.actual_cost > self.contract.total_cost:
            raise ValidationError({
                'actual_cost': "Фактический кассовый расход по кварталу не может превышать общую сумму договора."
            })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
