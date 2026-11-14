from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Sum
# from rest_framework.exceptions import ValidationError

from core.choices import PlanItemStatus, ProcurementItemTypes
from .budgetCosts import BudgetCosts
from .department import Department

class PlanShare(models.Model):
    """
    Внутреннее распределение годового финансирования по подразделениям ГКСЭ.
    Отвечает за строки в рабочем Excel-плане, лимиты и привязку строк договоров.
    """
    status = models.CharField("Статус", max_length=20, choices=PlanItemStatus.choices, default=PlanItemStatus.ACTIVE, db_index=True)
    budget_cost = models.ForeignKey(BudgetCosts, on_delete=models.PROTECT, related_name='plan_shares', verbose_name="Финансирование по пункту плана закупки")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="plan_shares", verbose_name="Подразделение ГКСЭ")
    shared_amount = models.DecimalField("Количество для подразделения", max_digits=12, decimal_places=3, default=0)
    shared_cost = models.DecimalField("Сумма для подразделения (BYN)", max_digits=15, decimal_places=2, default=0)
    shared_fund_cost = models.DecimalField("Сумма для подразделения (внебюджетные фонды) (BYN)", max_digits=15, decimal_places=2, default=0)
    shared_inner_cost = models.DecimalField("Сумма для подразделения (собственные средства) (BYN)", max_digits=15, decimal_places=2, default=0)
    # Заявка на изменение (Этап 2), в рамках которой создан этот черновик-снимок (см. PlanItemDetail.change_request).
    change_request = models.ForeignKey(
        'ChangeRequest', on_delete=models.PROTECT, related_name='draft_plan_shares',
        verbose_name="Заявка на изменение", null=True, blank=True,
    )

    class Meta:
        verbose_name = "Внутреннее распределение по подразделениям"
        verbose_name_plural = "Внутреннее распределение по подразделениям"

    def __str__(self):
        return f"{self.department.short_name} ({self.budget_cost.year} г.) — кол-во: {self.shared_amount}, сумм: {self.shared_cost} BYN"

    def clean(self):
        # Бизнес-ограничения на распределение лимита (ниже) имеют смысл только для
        # ДЕЙСТВУЮЩИХ записей. Черновики заявки на изменение (Этап 2) клонируют ACTIVE-строки
        # в статус DRAFT ДО того, как старые ACTIVE-строки архивируются — без этой проверки
        # клон с тем же shared_amount удваивал бы сумму против ещё-живого оригинала и ложно
        # падал бы с "превышением". Когда черновик реально становится ACTIVE (одобрение,
        # procurement.services.change_requests.approve), к этому моменту старые строки уже
        # archived — проверка сработает корректно на финальном состоянии.
        #
        # Ошибки — словарём {поле: текст}, а не одной строкой: DRF не перехватывает
        # django.core.exceptions.ValidationError, брошенный из save()/full_clean() — без
        # серверной проверки до сохранения PATCH/POST /api/plan_shares/ с превышением лимита
        # падал голым 500 (найдено пользователем 2026-11-14, см. CurrentStatus.md).
        # PlanShareSerializer.validate() прогоняет этот clean() на preview-копии ДО сохранения
        # и конвертирует его в чистый 400 — тот же паттерн, что у TreasuryPaymentSerializer.
        super().clean()
        if self.status == PlanItemStatus.ACTIVE and self.shared_amount:
            plan_item = self.budget_cost.plan_item if self.budget_cost else None
            if plan_item:
                detail = plan_item.details.filter(status=PlanItemStatus.ACTIVE).first()

                if detail:
                    active_budgets = plan_item.budget_costs.filter(status=PlanItemStatus.ACTIVE)

                    # Для услуг (type=job), реально распределённых НА НЕСКОЛЬКО ЛЕТ разными
                    # строками бюджета, "количество" — почти всегда формальная единица (обычно
                    # "1" на каждый год), а не физически делимая величина. Многолетняя услуга,
                    # оплачиваемая несколькими договорами/годами (см. реестр rd26, позиции
                    # 166/952 — суммарная стоимость совпадает с планом, а "1 услуга в 2026" +
                    # "1 услуга в 2027" формально суммируется в "2", хотя услуга одна), иначе
                    # давала бы ложное превышение при сквозном по годам контроле количества.
                    # Для товаров (type=product), а также для услуг В РАМКАХ ОДНОГО ГОДА
                    # (несколько подразделений делят одну и ту же годовую строку бюджета)
                    # проверка остаётся обязательной — она ловит реальные ошибки распределения
                    # (найдено пользователем 2026-11-14: /plan-items/2898, val_amount=153,
                    # распределение по подразделениям можно было набить сверх этого без единой
                    # ошибки, потому что проверка раньше пропускалась для ЛЮБОЙ услуги целиком).
                    distinct_years = set(active_budgets.values_list('year', flat=True))
                    is_multi_year_job_split = (
                        detail.type == ProcurementItemTypes.job and len(distinct_years) > 1
                    )

                    if not is_multi_year_job_split:
                        total_allowed_amount = detail.val_amount

                        shares_queryset = PlanShare.objects.filter(
                            budget_cost__in=active_budgets,
                            status=PlanItemStatus.ACTIVE
                        )
                        if self.pk:
                            shares_queryset = shares_queryset.exclude(pk=self.pk)

                        already_saved_amount = shares_queryset.aggregate(total=Sum('shared_amount'))['total'] or 0

                        if total_allowed_amount < (already_saved_amount + self.shared_amount):
                            raise ValidationError({'shared_amount': (
                                f"Превышение общего количества по пункту плана! "
                                f"Выделено на весь период закупки: {total_allowed_amount}. "
                                f"Уже распределено (за все года): {already_saved_amount}. "
                                f"Попытка добавить в {self.budget_cost.year} году: {self.shared_amount}."
                            )})

        if self.status == PlanItemStatus.ACTIVE and self.shared_cost:
            b_cost = self.budget_cost
            if b_cost:
                # Многолетнее резервирование (Этап 3.1/3.2, ТЗ п.5) — часть суммы статьи
                # может быть уже обязана договорами, заключёнными ДО появления этой строки
                # бюджета (напр. многолетний договор 2026 года, резервирующий часть 2027
                # года, когда план 2027 ещё не был распределён). "Видимый" номинал статьи
                # для распределения по подразделениям уменьшается на эту сумму — см.
                # procurement.services.multi_year_reservation.
                from procurement.services.multi_year_reservation import compute_reserved_amount
                reserved = compute_reserved_amount(b_cost.plan_item, b_cost.year)
                total_cost = b_cost.cost - reserved

                shares_queryset = PlanShare.objects.filter(
                    budget_cost=self.budget_cost,
                    status=PlanItemStatus.ACTIVE
                )
                if self.pk:
                    shares_queryset = shares_queryset.exclude(pk=self.pk)

                already_saved_cost = shares_queryset.aggregate(total=Sum('shared_cost'))['total'] or 0

                if total_cost < (already_saved_cost + self.shared_cost):
                    reserved_note = f" (из них {reserved} BYN уже зарезервировано многолетними договорами)" if reserved else ""
                    raise ValidationError({'shared_cost': (
                        f"Превышение суммы в {self.budget_cost.year} году! "
                        f"Доступно для распределения: {total_cost} BYN{reserved_note}. "
                        f"Уже распределено: {already_saved_cost} BYN. "
                        f"Попытка добавить: {self.shared_cost} BYN."
                    )})

        if self.status == PlanItemStatus.ACTIVE and self.shared_fund_cost:
            detail = self.budget_cost.plan_item.details.filter(status=PlanItemStatus.ACTIVE).first()
            if detail:
                total_fund_cost = detail.fund_cost

                shares_queryset = PlanShare.objects.filter(
                    budget_cost=self.budget_cost,
                    status=PlanItemStatus.ACTIVE
                )
                if self.pk:
                    shares_queryset = shares_queryset.exclude(pk=self.pk)

                already_saved_fund_cost = shares_queryset.aggregate(total=Sum('shared_fund_cost'))['total'] or 0

                if total_fund_cost < (already_saved_fund_cost + self.shared_fund_cost):
                    raise ValidationError({'shared_fund_cost': (
                        f"Превышение суммы (внебюджетные фонды) в {self.budget_cost.year} году! "
                        f"Выделено всего: {total_fund_cost}. "
                        f"Уже распределено: {already_saved_fund_cost}. "
                        f"Попытка добавить: {self.shared_fund_cost}."
                    )})

        if self.status == PlanItemStatus.ACTIVE and self.shared_inner_cost:
            detail = self.budget_cost.plan_item.details.filter(status=PlanItemStatus.ACTIVE).first()
            if detail:
                total_inner_cost = detail.inner_cost

                shares_queryset = PlanShare.objects.filter(
                    budget_cost=self.budget_cost,
                    status=PlanItemStatus.ACTIVE
                )
                if self.pk:
                    shares_queryset = shares_queryset.exclude(pk=self.pk)

                already_saved_inner_cost = shares_queryset.aggregate(total=Sum('shared_inner_cost'))['total'] or 0

                if total_inner_cost < (already_saved_inner_cost + self.shared_inner_cost):
                    raise ValidationError({'shared_inner_cost': (
                        f"Превышение суммы (собственные средства) в {self.budget_cost.year} году! "
                        f"Выделено всего: {total_inner_cost}. "
                        f"Уже распределено: {already_saved_inner_cost}. "
                        f"Попытка добавить: {self.shared_inner_cost}."
                    )})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)