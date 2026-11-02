from django.db import models
from django.conf import settings
from core.choices import PlanItemStatus
from .functionalCode import FunctionalCode
from .programCode import ProgramCode
from .internalEconomicClassifier import InternalEconomicClassifier
from .externalEconomicCode import ExternalEconomicCode
from .planItem import PlanItem
from procurement.services import get_current_year, decoder_iec


class BudgetCosts(models.Model):
    """Финансовое обеспечение позиции плана по конкретному году финансирования (из API)"""

    plan_item = models.ForeignKey(PlanItem, on_delete=models.PROTECT, related_name='budget_costs', verbose_name="Версия пункта плана", null=True, blank=True, default=None)
    created_at = models.DateTimeField(auto_now_add=True)
    changed_at = models.DateTimeField(auto_now=True)
    status = models.CharField("Статус", max_length=20, choices=PlanItemStatus.choices, default=PlanItemStatus.DRAFT, db_index=True)
    # Заявка на изменение (Этап 2), в рамках которой создан этот черновик-снимок (см. PlanItemDetail.change_request).
    change_request = models.ForeignKey(
        'ChangeRequest', on_delete=models.PROTECT, related_name='draft_budget_costs',
        verbose_name="Заявка на изменение", null=True, blank=True,
    )

    # Данные, которые получаем с goszakupki.by
    purchases_items_id = models.IntegerField("id позиции ГПЗ на goszakupki.by")
    cost = models.DecimalField("Ориентировочная стоимость позиции ГПЗ", max_digits=15, decimal_places=2, default=0)

    functional_class = models.ForeignKey(FunctionalCode, on_delete=models.PROTECT, related_name="budget_costs", verbose_name="Функциональная классификация", null=True, blank=True)
    functional_code = models.CharField("Функциональный код goszakupki.by", max_length=32, null=True, blank=True)

    department_code = models.CharField("Код ведомственной классификации", max_length=16, null=True, blank=True)

    economic_code = models.CharField("Экономический код goszakupki.by", max_length=32, null=True, blank=True)
    economic_class = models.ForeignKey(ExternalEconomicCode, on_delete=models.PROTECT, related_name="budget_costs", verbose_name="Внешний код ЭКР", null=True, blank=True)

    program_code = models.CharField("Программный код goszakupki.by", max_length=16, null=True, blank=True)
    program_class = models.ForeignKey(ProgramCode, on_delete=models.PROTECT, related_name="budget_costs", verbose_name="Программная классификация", null=True, blank=True)

    budget_code = models.IntegerField("Код бюджета позиции плана", default=settings.DEFAULT_BUDGET_CODE)
    budget_code_name = models.CharField("Описание кода бюджета", max_length=255, default=settings.DEFAULT_BUDGET_CODE_NAME)
    unk = models.CharField("УНК заказчика позиции", max_length=32, blank=True, null=True, default=settings.DEFAULT_UNK)
    tk_id = models.IntegerField("Код территориального казначейства", blank=True, null=True, default=settings.DEFAULT_TK_ID)
    year = models.PositiveIntegerField("Год финансирования из бюджета", db_index=True, default=get_current_year)

    # Дополнительные внутренние аналитические коды ГКСЭ. Связываем закупку со справочником кодов
    internal_economic_class = models.ForeignKey(InternalEconomicClassifier, on_delete=models.PROTECT, related_name='budget_costs', verbose_name="Экономический код расходов (ЭКР)", blank=True, null=True)
    # Денормализованные ForeignKeys на родительские статьи справочника
    internal_economic_section = models.ForeignKey(InternalEconomicClassifier, on_delete=models.PROTECT, related_name='section_costs', null=True, blank=True, verbose_name="Раздел (Уровень 1)")
    internal_economic_subsection = models.ForeignKey(InternalEconomicClassifier, on_delete=models.PROTECT, related_name='subsection_costs', null=True, blank=True, verbose_name="Подраздел (Уровень 2)")
    internal_economic_kind = models.ForeignKey(InternalEconomicClassifier, on_delete=models.PROTECT, related_name='kind_costs', null=True, blank=True, verbose_name="Вид (Уровень 3)")
    internal_economic_article = models.ForeignKey(InternalEconomicClassifier, on_delete=models.PROTECT, related_name='article_costs', null=True, blank=True, verbose_name="Статья (Уровень 4)")

    class Meta:
        verbose_name = "Бюджетное финансирование"
        verbose_name_plural = "Бюджетное финансирование"

    def save(self, *args, **kwargs):
        """Автоматическая привязка к существующим родительским статьям ЭКР при сохранении"""
        if self.internal_economic_class:
            section_id, subsection_id, kind_id, article_id = decoder_iec(self.internal_economic_class)

            if section_id:
                self.internal_economic_section_id = section_id
            if subsection_id:
                self.internal_economic_subsection_id = subsection_id
            if kind_id:
                self.internal_economic_kind_id = kind_id
            if article_id:
                self.internal_economic_article_id = article_id

        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.plan_item.num} {self.year} {self.purchases_items_id})"

    # def get_total_cost_for_root_department(self, department_id):
    #     """
    #     Возвращает сумму всех расходов по конкретному ГУ (включая все его подотделы)
    #     для данной годовой бюджетной строки.
    #     """
    #     from django.db.models import Sum, Q
    #
    #     # Находим сумму долей, привязанных напрямую к ГУ + долей его дочерних подразделений
    #     total = self.shares.filter(
    #         Q(department_id=department_id) | Q(department__parent_id=department_id)
    #     ).aggregate(total_sum=Sum('shared_cost'))['total_sum']
    #
    #     return total or 0

    # Это должно быть не здесь!!! Идея хорошая, но проверяется не так!!!
    # def validate_limits(self):
    #     """
    #     Валидация: Сумма всех распределенных по подотделам денег
    #     не должна превышать общую выделенную годовую сумму из API.
    #     """
    #     from django.db.models import Sum
    #     total_distributed = self.shares.aggregate(total=Sum('shared_cost'))['total'] or 0
    #
    #     if total_distributed > self.cost:
    #         raise ValidationError(
    #             f"Перерасход лимитов в {self.year} году! "
    #             f"Выделено: {self.cost} BYN, Распределено по управлениям: {total_distributed} BYN."
    #         )

