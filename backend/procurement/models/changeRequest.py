from django.db import models

from core.choices import ChangeRequestKind, ChangeRequestStatus
from .planItem import PlanItem


class ChangeRequest(models.Model):
    """
    Заявка на изменение — общий движок одобрения (Этап 2, решение пользователя 2026-11-02:
    проектируется сразу как общий механизм для разных видов изменений, не только для
    изменения/исключения позиции плана закупщиком).

    Для kind=PLAN_ITEM_CHANGE сервисный слой (procurement.services.change_requests) при
    создании копирует АКТИВНЫЕ PlanItemDetail/BudgetCosts/PlanShare позиции в статус DRAFT,
    привязывая их к этой заявке через FK `change_request` (см. модели PlanItemDetail,
    BudgetCosts, PlanShare). Специалист правит черновик обычными PATCH-запросами, затем
    отправляет на проверку — дочерние записи переводятся в PlanItemStatus.DRAFT_ON_REVIEW.
    При одобрении старые ACTIVE-записи архивируются, черновик становится ACTIVE; при
    отклонении черновик помечается DRAFT_REJECTED (не удаляется — это и есть история).

    Для kind=PLAN_ITEM_EXCLUSION (решение пользователя: без редактируемого черновика полей)
    заявка создаётся сразу в статусе ON_REVIEW, без копирования PlanItemDetail/BudgetCosts/
    PlanShare — это просто запрос «архивировать позицию» с обоснованием в `reason`.

    Для kind=LIMIT_REDISTRIBUTION (Этап 3.3/перераспределение) черновик — это НЕ клон
    PlanItemDetail/BudgetCosts/PlanShare, а набор строк `BudgetQuarterlyLimit` со статусом
    DRAFT (новые предлагаемые суммы на конкретный держатель/статью/квартал). При одобрении
    для каждой строки архивируется старая ACTIVE запись с тем же (budget_cost, plan_share,
    quarter) и активируется черновик — тот же приём, что и у PLAN_ITEM_CHANGE, только для
    другой модели. `plan_item` у такой заявки не задан (перераспределение не привязано к
    одной позиции плана).

    kind=BUDGET_LIMIT_CORRECTION — приём корректировок укрупнённых статей от Казначейства
    (fin_2026.xlsb, Этап 3.4) — черновик строится разбором файла, создаёт строки
    ArticleQuarterlyAllocation со статусом DRAFT; сумма не обязана быть нулевой (это полный
    снимок статей, не перераспределение).

    kind=DEPARTMENT_LIMIT_CALIBRATION — калибровка внутренней разбивки статьи на подстатьи
    (наш внутренний классификатор) и далее на держателей лимита (Этап, решение пользователя
    2026-11-03). Черновик — строки DepartmentArticleLimit со статусом DRAFT; forecast
    показывает две сверки (подстатьи <= доступно по статье; держатели подстатьи <= сумма
    подстатьи), применить нельзя только при перерасходе — недораспределение допустимо.
    """
    plan_item = models.ForeignKey(
        PlanItem, on_delete=models.PROTECT, related_name='change_requests',
        verbose_name="Позиция плана",
        # Nullable — у будущего BUDGET_LIMIT_CORRECTION (Этап 3.4) цель может не сводиться
        # к одной позиции плана (корректировка по статье/подразделению может затрагивать
        # несколько позиций сразу).
        null=True, blank=True,
    )
    kind = models.CharField("Вид заявки", max_length=32, choices=ChangeRequestKind.choices)
    status = models.CharField("Статус", max_length=16, choices=ChangeRequestStatus.choices,
                              default=ChangeRequestStatus.DRAFT, db_index=True)

    reason = models.TextField(
        "Обоснование заявителя", blank=True,
        help_text="Для исключения позиции — обязательно; для изменения — опциональный комментарий.",
    )
    rejection_reason = models.TextField("Причина отклонения", blank=True)

    submitted_at = models.DateTimeField("Отправлена на проверку", null=True, blank=True)
    reviewed_at = models.DateTimeField("Решение принято", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    changed_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Заявка на изменение"
        verbose_name_plural = "Заявки на изменение"
        ordering = ['-created_at']

    def __str__(self):
        target = self.plan_item.num if self.plan_item_id else '—'
        return f"{self.get_kind_display()} [{target}] — {self.get_status_display()}"
