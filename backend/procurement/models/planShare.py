from django.db import models

from .budgetCosts import BudgetCosts
from .department import Department

class PlanShare(models.Model):
    """
    Внутреннее распределение годового финансирования по подразделениям ГКСЭ.
    Отвечает за строки в рабочем Excel-плане, лимиты и привязку строк договоров.
    """
    budget_cost = models.ForeignKey(BudgetCosts, on_delete=models.CASCADE, related_name='shares', verbose_name="Годовое финансирование закупки")
    # Идеальная связь через ForeignKey вместо ненадежной строки
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="plan_shares", verbose_name="Подразделение ГКСЭ")
    # Внутренняя разбивка для контроля лимитов (Количество: 100 / Сумма: 48000)
    shared_amount = models.DecimalField("Количество для подразделения", max_digits=12, decimal_places=3, default=0)
    shared_cost = models.DecimalField("Сумма для подразделения (BYN)", max_digits=15, decimal_places=2, default=0)

    class Meta:
        verbose_name = "Внутреннее распределение по подразделениям"
        verbose_name_plural = "Внутреннее распределение по подразделениям"

    def __str__(self):
        return f"{self.department_name} ({self.budget_cost.year} г.) — {self.shared_cost} BYN"
