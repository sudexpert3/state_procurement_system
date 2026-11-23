from datetime import date

from django.db import models

from core.choices import PlanItemStatus
from .functionalCode import FunctionalCode
from .externalEconomicCode import ExternalEconomicCode
from .internalEconomicClassifier import InternalEconomicClassifier
from .department import Department


class DepartmentArticleLimit(models.Model):
    """
    Распределение укрупнённой статьи Минфина (`ArticleQuarterlyAllocation`,
    functional_class+economic_class) по держателям лимита (подразделениям) — один уровень:
    каждая запись = доля ОДНОГО держателя по ОДНОЙ подстатье (внутренний классификатор ГКСЭ,
    `internal_economic_class`) за год. Правится напрямую финансистом/админом (доступ —
    `procurement.permissions.CAPABILITIES['department_limits']`), без согласования —
    решение пользователя (2026-11-23): "Распределение лимитов не требует утверждения
    финансиста, потому что только финансист (и администратор) могут корректировать лимиты".

    Раньше (Этап 9, до 2026-11-23) здесь было два уровня через общий движок `ChangeRequest`
    (kind=DEPARTMENT_LIMIT_CALIBRATION): отдельная строка "подстатья целиком"
    (department=NULL) и отдельные строки держателей. Второй уровень в проде не использовался
    (0 записей на момент переделки) — убран, `department` теперь обязателен.

    Версионирование — через сами статусы записи, не через `ChangeRequest`:
    - DRAFT — черновик, свободно редактируется целиком.
    - ACTIVE — действующая запись; правится только `note`/`deactivated_at` (сумму/
      подразделение/статью меняют новой записью, не правкой существующей — история
      версий лимита должна сохраняться построчно, решение пользователя 2026-11-03).
    - ARCHIVE — вытеснена более новой активной записью той же связки (держатель+статья+
      параграф+подстатья+год) через `services.department_limits.activate_limit()`.

    Перерасход (сумма ACTIVE-записей статьи/параграфа/года больше доступного по
    `ArticleQuarterlyAllocation` минус резерв многолетних обязательств) НЕ блокируется —
    только предупреждение на фронте (см. `DepartmentArticleLimitViewSet.article_availability`/
    `overspend_summary`). Недораспределение — нормальное состояние.

    Доступный для новых договоров остаток лимита держателя считается ВНЕ этой модели
    (services/department_limits.py) — вычитанием уже зарезервированного через PlanShare
    (department+internal_economic_class+year), той же логикой, что в
    multi_year_reservation.py: "в BudgetCosts также находятся лимиты-части подразделений...
    суммы резервируются" (пользователь, 2026-11-03).
    """
    status = models.CharField("Статус", max_length=20,
                              choices=[(c.value, c.label) for c in
                                       (PlanItemStatus.DRAFT, PlanItemStatus.ACTIVE, PlanItemStatus.ARCHIVE)],
                              default=PlanItemStatus.DRAFT, db_index=True)
    functional_class = models.ForeignKey(FunctionalCode, on_delete=models.PROTECT,
                                         related_name='department_limits',
                                         verbose_name="Функциональная классификация (раздел/параграф)")
    economic_class = models.ForeignKey(ExternalEconomicCode, on_delete=models.PROTECT,
                                       related_name='department_limits',
                                       verbose_name="Статья ЭКР (внешняя, от Минфина/Казначейства)")
    internal_economic_class = models.ForeignKey(InternalEconomicClassifier, on_delete=models.PROTECT,
                                                 related_name='department_limits',
                                                 verbose_name="Подстатья (внутренний классификатор ГКСЭ)")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name='article_limits',
                                   verbose_name="Держатель лимита (подразделение)")
    year = models.PositiveIntegerField("Год", db_index=True)
    amount = models.DecimalField("Сумма лимита (BYN)", max_digits=15, decimal_places=2, default=0)
    note = models.TextField("Примечание", blank=True)
    # Дата внесения/правки записи — бизнес-поле (не аудит-штамп), по умолчанию сегодня,
    # редактируется пользователем (решение пользователя 2026-11-23).
    effective_date = models.DateField("Дата записи", default=date.today)
    # Заполняется вручную ИЛИ автоматически в activate_limit() при вытеснении более новой
    # записью (если не задано) — не auto_now, это бизнес-дата, не аудит.
    deactivated_at = models.DateField("Дата деактивации", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    changed_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Лимит подразделения по подстатье"
        verbose_name_plural = "Лимиты подразделений по подстатьям"
        ordering = ['-year', 'economic_class_id', 'internal_economic_class_id']
        constraints = [
            models.UniqueConstraint(
                fields=['functional_class', 'economic_class', 'internal_economic_class', 'department', 'year'],
                condition=models.Q(status=PlanItemStatus.ACTIVE),
                name='unique_active_department_limit',
            ),
        ]

    def __str__(self):
        return (f"{self.economic_class.code_api} / {self.internal_economic_class.code} — "
                f"{self.department.short_name}, {self.year} г.: {self.amount} BYN")
