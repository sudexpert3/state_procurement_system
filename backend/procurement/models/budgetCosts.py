from django.db import models
from django.utils import timezone
from django.conf import settings
from .functionalCode import FunctionalCode
from .programCode import ProgramCode
from .economicClassifier import EconomicClassifier
from .externalEconomicCode import ExternalEconomicCode
from .plan import PlanVersion


def get_current_year():
    """Динамическое вычисление текущего календарного года без фиксации в памяти"""
    return timezone.now().year

class BudgetCosts(models.Model):
    """Финансовое обеспечение позиции плана по конкретному году финансирования (из API)"""

    plan_version = models.ForeignKey(PlanVersion, on_delete=models.CASCADE, related_name='budget_costs', verbose_name="Версия пункта плана")
    purchases_items_id = models.IntegerField("id позиции ГПЗ на goszakupki.by")
    year = models.PositiveIntegerField("Год финансирования из бюджета", db_index=True, default=get_current_year)
    cost = models.DecimalField("Ориентировочная стоимость позиции ГПЗ", max_digits=15, decimal_places=2, default=0)
    # Бюджетная классификация Республики Беларусь (коды пишем строками, так как они с пробелами)
    functional_class = models.ForeignKey( FunctionalCode, on_delete=models.PROTECT, related_name="budget_costs", verbose_name="Функциональная классификация", null=True, blank=True)
    external_economic_class = models.ForeignKey(ExternalEconomicCode, on_delete=models.PROTECT, related_name="budget_costs", verbose_name="Внешний код ЭКР", null=True, blank=True)
    program_class = models.ForeignKey(ProgramCode, on_delete=models.PROTECT, related_name="budget_costs", verbose_name="Программная классификация", null=True, blank=True)

    department_code = models.CharField("Код ведомственной классификации", max_length=16, null=True, blank=True)
    budget_code = models.IntegerField("Код бюджета позиции плана", default=settings.DEFAULT_BUDGET_CODE)
    budget_code_name = models.CharField("Описание кода бюджета", max_length=255, default=settings.DEFAULT_BUDGET_CODE_NAME)
    unk = models.CharField("УНК заказчика позиции", max_length=32, blank=True, null=True, default=settings.DEFAULT_UNK)
    tk_id = models.IntegerField("Код территориального казначейства", blank=True, null=True, default=settings.DEFAULT_TK_ID)

    # Дополнительные внутренние аналитические коды ГКСЭ. Связываем закупку со справочником кодов
    economic_class = models.ForeignKey(EconomicClassifier, on_delete=models.PROTECT, related_name='budget_costs', verbose_name="Экономический код расходов (ЭКР)")

    # Денормализованные ForeignKeys на родительские статьи справочника для мгновенных JOIN в отчетах
    economic_section = models.ForeignKey(EconomicClassifier, on_delete=models.PROTECT, related_name='section_costs', null=True, blank=True, verbose_name="Раздел (Уровень 1)")
    economic_subsection = models.ForeignKey(EconomicClassifier, on_delete=models.PROTECT, related_name='subsection_costs', null=True, blank=True, verbose_name="Подраздел (Уровень 2)")
    economic_kind = models.ForeignKey(EconomicClassifier, on_delete=models.PROTECT, related_name='kind_costs', null=True, blank=True, verbose_name="Вид (Уровень 3)")
    economic_article = models.ForeignKey(EconomicClassifier, on_delete=models.PROTECT, related_name='article_costs', null=True, blank=True, verbose_name="Статья (Уровень 4)")

    class Meta:
        verbose_name = "Бюджетное финансирование"
        verbose_name_plural = "Бюджетное финансирование"
        # constraints = [
        #     models.UniqueConstraint(fields=['plan', 'year', 'economic_class'], name='unique_plan_year_economic_ekr')
        # ]

    def save(self, *args, **kwargs):
        """Автоматическая привязка к существующим родительским статьям ЭКР при сохранении"""
        if self.economic_class_id:
            # ИСПРАВЛЕНО: Проверяем канонический внутренний кэш Django для связи economic_class
            if hasattr(self, "_economic_class_cache"):
                code_str = self.economic_class.code
            else:
                from .economicClassifier import EconomicClassifier
                # Достаем ТОЛЬКО строковый код из базы через легкий индексный запрос
                code_str = (
                    EconomicClassifier.objects.filter(id=self.economic_class_id)
                    .values_list("code", flat=True)
                    .first()
                )

            if code_str:
                current_len = len(code_str)

                section_code = None
                subsection_code = None
                kind_code = None
                article_code = None

                # Динамическая нарезка по бесшаблонной структуре Минфина РБ (длина 10 или 7 знаков)
                if current_len == 10:
                    section_code = code_str[:1] + "000000"  # 1000000
                    subsection_code = code_str[:2] + "00000"  # 1100000
                    kind_code = code_str[:5] + "00"         # 1100300
                    article_code = code_str[:7]             # 1100303

                elif current_len == 7:
                    section_code = code_str[:1] + "000000"
                    subsection_code = code_str[:2] + "00000"
                    if not code_str.endswith("00005") and not code_str.endswith("00"):
                        kind_code = code_str[:5] + "00"
                        article_code = code_str

                # Собираем только определенные коды
                search_codes = [c for c in [section_code, subsection_code, kind_code, article_code] if c]

                from .economicClassifier import EconomicClassifier
                # Достаем ID родительских записей ОДНИМ быстрым SQL-запросом через __in
                parent_mappings = dict(
                    EconomicClassifier.objects.filter(code__in=search_codes).values_list("code", "id")
                )

                # Безопасно присваиваем ID напрямую на уровне СУБД
                self.economic_section_id = parent_mappings.get(section_code)
                self.economic_subsection_id = parent_mappings.get(subsection_code)
                self.economic_kind_id = parent_mappings.get(kind_code)
                self.economic_article_id = parent_mappings.get(article_code)

        super().save(*args, **kwargs)

    def __str__(self):
        gos_id = self.plan_version.plan_goszakupki_id if self.plan_version_id else "БЕЗ_ID"
        ekr_code = self.economic_class.code if self.economic_class_id else "НЕТ_ЭКР"
        return f"{self.year} г. ID Госзакупки: {gos_id} — {self.cost} BYN ({ekr_code})"

    def get_total_cost_for_root_department(self, department_id):
        """
        Возвращает сумму всех расходов по конкретному ГУ (включая все его подотделы)
        для данной годовой бюджетной строки.
        """
        from django.db.models import Sum, Q

        # Находим сумму долей, привязанных напрямую к ГУ + долей его дочерних подразделений
        total = self.shares.filter(
            Q(department_id=department_id) | Q(department__parent_id=department_id)
        ).aggregate(total_sum=Sum('shared_cost'))['total_sum']

        return total or 0

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


    # economic_code = models.CharField(
    #     "Код экономической классификация (ЭКР) (внешний)",
    #     max_length=64,
    #     choices=ExternalEconomicCodeType.choices,  # Подключаем choices
    #     null=True,
    #     blank=True,
    # )
    # program_code = models.CharField("Код программной классификации", choices=ProgramCodeType.choices, default=ProgramCodeType.CODE_99_0, max_length=16, null=True, blank=True)
    # functional_code = models.CharField("Код функциональной классификации", choices=FunctionalCodeType.choices, max_length=32, null=True, blank=True)