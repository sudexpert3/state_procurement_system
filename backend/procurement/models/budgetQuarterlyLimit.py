from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum

from core.choices import PlanItemStatus, QuarterTypes
from .budgetCosts import BudgetCosts
from .planShare import PlanShare


class BudgetQuarterlyLimit(models.Model):
    """
    Квартальное распределение лимита (Этап 3.3) — НЕ то же самое, что ContractQuarterlyFinance
    (та отвечает за план/факт ИСПОЛНЕНИЯ ПО ДОГОВОРУ). Это доведённый Казначейством лимит на
    квартал по статье расходов (`budget_cost`), опционально разбитый по держателям лимита
    (`plan_share`, см. ту же двухуровневую схему, что у годовой суммы: BudgetCosts.cost —
    статья целиком, PlanShare.shared_cost — доля конкретного подразделения).

    Источник корректировок — Этап 3.4 (разбор fin_2026.xlsb от Казначейства) и/или ручное
    перераспределение специалистом между держателями/статьями/кварталами — оба сценария
    проходят через общий движок одобрения `ChangeRequest` (Этап 2): корректировка создаётся
    как новый черновик (status=DRAFT, change_request=...), старая ACTIVE-запись архивируется
    при одобрении — та же схема версионирования, что у `BudgetCosts`/`PlanItemDetail`.
    """
    status = models.CharField("Статус", max_length=20, choices=PlanItemStatus.choices,
                              default=PlanItemStatus.ACTIVE, db_index=True)
    budget_cost = models.ForeignKey(BudgetCosts, on_delete=models.PROTECT, related_name='quarterly_limits',
                                    verbose_name="Статья расходов (год)")
    # Null — лимит на статью целиком, ещё не распределённый по держателям. Заполнено — доля
    # конкретного подразделения (аналогично необязательному contract_item у ContractQuarterlyFinance).
    plan_share = models.ForeignKey(PlanShare, on_delete=models.PROTECT, related_name='quarterly_limits',
                                   verbose_name="Держатель лимита (подразделение)", null=True, blank=True)
    quarter = models.CharField("Квартал", max_length=2, choices=QuarterTypes.choices, db_index=True)
    amount = models.DecimalField("Сумма лимита на квартал (BYN)", max_digits=15, decimal_places=2, default=0)

    change_request = models.ForeignKey(
        'ChangeRequest', on_delete=models.PROTECT, related_name='draft_quarterly_limits',
        verbose_name="Заявка на изменение", null=True, blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    changed_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Квартальное распределение лимита"
        verbose_name_plural = "Квартальные распределения лимитов"
        ordering = ['budget_cost__year', 'quarter']
        constraints = [
            # Среди ДЕЙСТВУЮЩИХ записей — не больше одной на (статья, квартал) без держателя...
            models.UniqueConstraint(
                fields=['budget_cost', 'quarter'],
                condition=models.Q(plan_share__isnull=True, status=PlanItemStatus.ACTIVE),
                name='unique_active_budget_quarter_limit',
            ),
            # ...и не больше одной на (держатель, квартал), если распределено по подразделениям.
            models.UniqueConstraint(
                fields=['plan_share', 'quarter'],
                condition=models.Q(plan_share__isnull=False, status=PlanItemStatus.ACTIVE),
                name='unique_active_share_quarter_limit',
            ),
        ]

    def __str__(self):
        target = self.plan_share.department.short_name if self.plan_share_id else self.budget_cost
        return f"{target} — {self.get_quarter_display()} {self.budget_cost.year} г.: {self.amount} BYN"

    def clean(self):
        super().clean()
        # Как и у PlanShare (см. planShare.py) — бизнес-ограничение имеет смысл только для
        # ДЕЙСТВУЮЩИХ записей; черновики заявки на изменение проверяются при одобрении, когда
        # старая ACTIVE-запись уже архивирована.
        if self.status != PlanItemStatus.ACTIVE or not self.plan_share_id:
            return

        # Сумма долей держателей за квартал не должна превышать лимит статьи на тот же квартал
        # (если он уже доведён и распределён по кварталам — пока нет, проверка просто не сработает).
        article_limit = BudgetQuarterlyLimit.objects.filter(
            budget_cost=self.plan_share.budget_cost, plan_share__isnull=True,
            quarter=self.quarter, status=PlanItemStatus.ACTIVE,
        ).first()
        if not article_limit:
            return

        siblings = BudgetQuarterlyLimit.objects.filter(
            budget_cost=self.plan_share.budget_cost, quarter=self.quarter,
            plan_share__isnull=False, status=PlanItemStatus.ACTIVE,
        )
        if self.pk:
            siblings = siblings.exclude(pk=self.pk)
        already = siblings.aggregate(s=Sum('amount'))['s'] or 0

        if article_limit.amount < (already + self.amount):
            raise ValidationError(
                f"Превышение квартального лимита статьи! Доведено на {self.get_quarter_display()}: "
                f"{article_limit.amount} BYN. Уже распределено по держателям: {already} BYN. "
                f"Попытка добавить: {self.amount} BYN."
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
