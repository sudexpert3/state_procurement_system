from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum
from .contract import Contract
from ..services import get_current_year
from core.choices import QuarterTypes




class ContractQuarterlyFinance(models.Model):
    """Квартальное казначейское планирование и кассовое исполнение договора"""
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='quarterly_finances', verbose_name="Договор")
    # Разрез по конкретной строке договора (= подразделению через PlanShare), если договор распределён
    # между несколькими подразделениями (см. rd26.xlsx: один договор, несколько подразделений в "реестре 26",
    # у каждого — свои квартальные суммы). Null — старые записи "на весь договор" без разбивки.
    contract_item = models.ForeignKey('ContractItem', on_delete=models.CASCADE, related_name='quarterly_finances',
                                      verbose_name="Строка договора (подразделение)", null=True, blank=True)
    quarter = models.CharField("Квартал", max_length=2, choices=QuarterTypes.choices, db_index=True)
    year = models.PositiveIntegerField("Год", db_index=True, default=get_current_year)

    planned_cost = models.DecimalField("Прогнозируемый (планируемый) расход", max_digits=15, decimal_places=2, default=0)
    actual_cost = models.DecimalField("Фактический расход (по платежным поручениям)", max_digits=15, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Квартальное финансирование договора"
        verbose_name_plural = "Квартальное финансирование договоров"
        constraints = [
            # Если разбивки по строке договора нет — уникальность в рамках (договор, год, квартал)
            models.UniqueConstraint(
                fields=['contract', 'quarter', 'year'],
                condition=models.Q(contract_item__isnull=True),
                name='unique_contract_quarter_per_year',
            ),
            # Если есть разбивка по подразделению — уникальность в рамках (строка договора, год, квартал)
            models.UniqueConstraint(
                fields=['contract_item', 'quarter', 'year'],
                condition=models.Q(contract_item__isnull=False),
                name='unique_contract_item_quarter_per_year',
            ),
        ]
        ordering = ['year', 'quarter']

    def __str__(self):
        return f"Договор № {self.contract.number} — {self.get_quarter_display()} {self.year} г."

    def clean(self):
        super().clean()

        # Валидация: факт НАРАСТАЮЩИМ ИТОГОМ (по всем кварталам/годам этой строки договора —
        # или всего договора, если разбивки по подразделению нет) не может быть больше суммы
        # договора (или доли подразделения в нём). Раньше сравнивалась ОДНА запись квартала —
        # ломалось на реальной казначейской практике "переплата в одном квартале, минусовая
        # корректировка в следующем" (найдено 2026-10-29 на договоре "1214-ти/3": факт Q2
        # 30518.55 сам по себе превышал сумму договора 24697.08, хотя за год с учётом
        # корректировки Q3 (-5821.47) итог точно совпадал с суммой договора).
        if self.contract_item_id:
            limit = self.contract_item.contract_cost
            qs = ContractQuarterlyFinance.objects.filter(contract_item_id=self.contract_item_id)
        else:
            limit = self.contract.total_cost
            qs = ContractQuarterlyFinance.objects.filter(contract_id=self.contract_id, contract_item__isnull=True)
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        already_actual = qs.aggregate(total=Sum('actual_cost'))['total'] or Decimal('0')
        cumulative_actual = already_actual + self.actual_cost

        if cumulative_actual > limit:
            raise ValidationError({
                'actual_cost': (
                    f"Фактический кассовый расход нарастающим итогом ({cumulative_actual}) "
                    f"не может превышать сумму договора/строки договора ({limit})."
                )
            })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
