from django.db import models

from core.choices import PlanItemStatus
from .functionalCode import FunctionalCode
from .externalEconomicCode import ExternalEconomicCode
from .internalEconomicClassifier import InternalEconomicClassifier
from .department import Department


class DepartmentArticleLimit(models.Model):
    """
    Внутренняя разбивка укрупнённой статьи Минфина (`ArticleQuarterlyAllocation`,
    functional_class+economic_class) — в два шага, как это реально делает финансист:

    1. Статья делится на ПОДСТАТЬИ — наш собственный внутренний классификатор
       (`internal_economic_class`), `department=NULL` — сумма на подстатью целиком, ещё не
       распределённая по держателям лимита.
    2. Каждая подстатья делится между держателями лимита — та же подстатья,
       `department` заполнен.

    Правило сверки (проверяется сервисом калибровки при approve(), НЕ в clean() — черновик
    по построению может быть временно "не сошедшимся", пока финансист его редактирует).
    Блокируется только ПЕРЕРАСХОД, недораспределение — нормальное состояние (пользователь
    сам привёл пример с положительным остатком "нераспределённых лимитов"):
    - Сумма ACTIVE-записей с department=NULL по статье (year) НЕ должна превышать (план
      ArticleQuarterlyAllocation статьи минус резерв многолетних обязательств прошлых лет).
    - Для каждой подстатьи сумма ACTIVE-записей с department != NULL НЕ должна превышать
      запись той же подстатьи с department=NULL.

    Версионирование — та же схема, что у BudgetQuarterlyLimit/ArticleQuarterlyAllocation:
    корректировка создаётся как новый черновик (status=DRAFT, change_request=...,
    kind=DEPARTMENT_LIMIT_CALIBRATION), старые ACTIVE-записи архивируются при одобрении —
    история корректировок сохраняется автоматически (требование пользователя 2026-11-03:
    "История таких корректировок должна храниться в обязательном порядке").

    Доступный для новых договоров остаток лимита держателя считается ВНЕ этой модели
    (services/department_limits.py) — вычитанием уже зарезервированного через PlanShare
    (department+internal_economic_class+year), той же логикой, что в
    multi_year_reservation.py: "в BudgetCosts также находятся лимиты-части подразделений...
    суммы резервируются" (пользователь, 2026-11-03).
    """
    status = models.CharField("Статус", max_length=20, choices=PlanItemStatus.choices,
                              default=PlanItemStatus.ACTIVE, db_index=True)
    functional_class = models.ForeignKey(FunctionalCode, on_delete=models.PROTECT,
                                         related_name='department_limits',
                                         verbose_name="Функциональная классификация (раздел/параграф)")
    economic_class = models.ForeignKey(ExternalEconomicCode, on_delete=models.PROTECT,
                                       related_name='department_limits',
                                       verbose_name="Статья ЭКР (внешняя, от Минфина/Казначейства)")
    internal_economic_class = models.ForeignKey(InternalEconomicClassifier, on_delete=models.PROTECT,
                                                 related_name='department_limits',
                                                 verbose_name="Подстатья (внутренний классификатор ГКСЭ)")
    # Null — сумма на подстатью целиком (ещё не распределена по держателям). Заполнено —
    # доля конкретного держателя лимита.
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name='article_limits',
                                   verbose_name="Держатель лимита (подразделение)", null=True, blank=True)
    year = models.PositiveIntegerField("Год", db_index=True)
    amount = models.DecimalField("Сумма (BYN)", max_digits=15, decimal_places=2, default=0)

    change_request = models.ForeignKey(
        'ChangeRequest', on_delete=models.PROTECT, related_name='draft_department_limits',
        verbose_name="Заявка на изменение", null=True, blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    changed_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Лимит подразделения по подстатье"
        verbose_name_plural = "Лимиты подразделений по подстатьям"
        ordering = ['year', 'economic_class_id', 'internal_economic_class_id']
        constraints = [
            models.UniqueConstraint(
                fields=['functional_class', 'economic_class', 'internal_economic_class', 'year'],
                condition=models.Q(department__isnull=True, status=PlanItemStatus.ACTIVE),
                name='unique_active_subarticle_total',
            ),
            models.UniqueConstraint(
                fields=['internal_economic_class', 'department', 'year'],
                condition=models.Q(department__isnull=False, status=PlanItemStatus.ACTIVE),
                name='unique_active_subarticle_department_limit',
            ),
        ]

    def __str__(self):
        target = self.department.short_name if self.department_id else "(подстатья целиком)"
        return (f"{self.economic_class.code_api} / {self.internal_economic_class.code} — "
                f"{target}, {self.year} г.: {self.amount} BYN")
