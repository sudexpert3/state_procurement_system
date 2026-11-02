from django.db import models

from core.choices import PlanItemStatus, QuarterTypes
from .functionalCode import FunctionalCode
from .externalEconomicCode import ExternalEconomicCode


class ArticleQuarterlyAllocation(models.Model):
    """
    Агрегатный квартальный лимит от Казначейства (Этап 3.4) — сумма НА ВСЮ статью ЭКР
    целиком (`functional_class` + `economic_class` + `year`), БЕЗ привязки к конкретной
    позиции плана. Казначейство в файле `fin_2026.xlsb` видит только агрегат по организации —
    не то, как мы делим его между сотнями позиций плана (одна статья может встречаться в
    тысяче с лишним `BudgetCosts` сразу). Это наше внутреннее решение — за него отвечают
    `BudgetQuarterlyLimit` (разбивка по держателям лимита) и механизм перераспределения
    (Этап 3.3, `ChangeRequest.kind=LIMIT_REDISTRIBUTION`).

    Источник корректировок — разбор `fin_2026.xlsb` (`services/fin_file_parser.py`), проходит
    через общий движок одобрения `ChangeRequest` (`kind=BUDGET_LIMIT_CORRECTION`): черновик —
    новый снимок со статусом DRAFT, при одобрении старый ACTIVE архивируется — та же схема
    версионирования, что у `BudgetCosts`/`BudgetQuarterlyLimit`.
    """
    status = models.CharField("Статус", max_length=20, choices=PlanItemStatus.choices,
                              default=PlanItemStatus.ACTIVE, db_index=True)
    functional_class = models.ForeignKey(FunctionalCode, on_delete=models.PROTECT,
                                         related_name='quarterly_allocations',
                                         verbose_name="Функциональная классификация (раздел/параграф)")
    economic_class = models.ForeignKey(ExternalEconomicCode, on_delete=models.PROTECT,
                                       related_name='quarterly_allocations',
                                       verbose_name="Статья ЭКР (внешняя, от Минфина/Казначейства)")
    year = models.PositiveIntegerField("Год", db_index=True)
    quarter = models.CharField("Квартал", max_length=2, choices=QuarterTypes.choices, db_index=True)
    amount = models.DecimalField("Назначено на квартал (BYN)", max_digits=15, decimal_places=2, default=0)

    change_request = models.ForeignKey(
        'ChangeRequest', on_delete=models.PROTECT, related_name='draft_article_allocations',
        verbose_name="Заявка на изменение", null=True, blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    changed_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Квартальный лимит статьи (Казначейство)"
        verbose_name_plural = "Квартальные лимиты статей (Казначейство)"
        ordering = ['year', 'quarter']
        constraints = [
            models.UniqueConstraint(
                fields=['functional_class', 'economic_class', 'year', 'quarter'],
                condition=models.Q(status=PlanItemStatus.ACTIVE),
                name='unique_active_article_quarterly_allocation',
            ),
        ]

    def __str__(self):
        return (f"{self.functional_class.code_api} / {self.economic_class.code_api} — "
                f"{self.get_quarter_display()} {self.year} г.: {self.amount} BYN")
