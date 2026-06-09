from django.db import models

from core.choices import ProcurementItemTypes, CurrencyTypes, PlanStatus
from .okrb import OkrbProduct
from .unitOfMeasurement import UnitOfMeasurement


class Plan(models.Model):
    """Мастер-запись позиции ГПЗ (сквозной неизменяемый идентификатор)"""
    num = models.CharField("Регистрационный номер позиции ГПЗ на goszakupki.by", max_length=64, null=True, blank=True, db_index=True)
    # Важнейший флаг для разграничения логики API и шифрования/скрытия данных
    is_public = models.BooleanField("Публикуется на goszakupki.by", default=True, db_index=True)
    status = models.CharField("Статус", max_length=20, choices=PlanStatus.choices, default=PlanStatus.DRAFT, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Пункт плана закупки (мастер-запись)"
        verbose_name_plural = "Пункты плана закупок (мастер-записи)"

        # Частичный умный индекс: гарантирует уникальность номера num ТОЛЬКО если позиция публичная.
        # Непубликуемые позиции (где num может быть пустой строкой или генерироваться позже) не вызовут конфликта в СУБД.
        constraints = [
            models.UniqueConstraint(
                fields=["num"],
                condition=models.Q(is_public=True, num__isnull=False),
                name="unique_num_for_public_plans",
            )
        ]

    def __str__(self):
        prefix = "ОТКРЫТАЯ" if self.is_public else "ЗАКРЫТАЯ"
        return f"[{prefix}] Позиция {self.num or 'БЕЗ НОМЕРА'} ({self.status})"

    def save(self, *args, **kwargs):
        """Автоматическая генерация внутреннего ведомственного номера для закрытых закупок"""
        # Если позиция непубликуемая и номер еще не присвоен (например, при создании черновика)
        if not self.is_public and not self.num:
            import datetime

            current_year = datetime.datetime.now().year

            # Ищем максимальный внутренний номер за текущий год, чтобы инкрементировать его
            # Шаблон номера: {year}-INTERNAL-{counter}
            prefix_filter = f"{current_year}-INTERNAL-"
            last_plan = (Plan.objects.filter(is_public=False, num__startswith=prefix_filter).order_by("-num").first())

            if last_plan and last_plan.num:
                try:
                    # Извлекаем числовой хвост (например из '2026-INTERNAL-0042' берем 42)
                    last_counter = int(last_plan.num.split("-")[-1])
                    new_counter = last_counter + 1
                except (ValueError, IndexError):
                    new_counter = 1
            else:
                new_counter = 1

            # Форматируем номер с ведущими нулями (например: 2026-INTERNAL-0001)
            self.num = f"{prefix_filter}{new_counter:04d}"

        super().save(*args, **kwargs)


class PlanVersion(models.Model):
    plan = models.ForeignKey(Plan, on_delete=models.CASCADE, related_name='versions')

    version_number = models.PositiveIntegerField("Номер версии", default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_active = models.BooleanField("Актуальная версия", default=True, db_index=True)

    plan_goszakupki_id = models.BigIntegerField("id позиции ГПЗ на goszakupki.by", null=True, blank=True)
    purchases_id = models.BigIntegerField("Идентификатор ГПЗ на goszakupki.by", null=True, blank=True, db_index=True)
    unp_budget = models.CharField("УНП", max_length=16, db_index=True)
    # num = models.CharField("Регистрационный номер позиции ГПЗ на goszakupki.by", max_length=32, db_index=True)
    title = models.TextField("Наименование позиции ГПЗ на goszakupki.by")

    okrb = models.CharField("Код ОКРБ 007 позиции ГПЗ на goszakupki.by", max_length=16, db_index=True)
    okrb_title = models.TextField("Наименование позиции ГПЗ на goszakupki.by")
    # Связь со справочником ОКРБ 007 вместо сырой строки
    okrb_product = models.ForeignKey(OkrbProduct, on_delete=models.PROTECT, related_name="plan_versions", verbose_name="Продукция по ОКРБ 007", null=True, blank=True)

    type = models.CharField("Вид предмета закупки для позиции ГПЗ на goszakupki.by", max_length=32, choices=ProcurementItemTypes.choices, default=ProcurementItemTypes.product)
    val_amount = models.DecimalField("Объем закупки позиции ГПЗ на goszakupki.by", default=0, max_digits=12, decimal_places=3)

    val_type = models.CharField("Код ОКРБ 008 позиции ГПЗ на goszakupki.by", max_length=8, db_index=True)
    val_unit = models.ForeignKey(UnitOfMeasurement, on_delete=models.PROTECT, related_name="plan_versions", verbose_name="Единица измерения", null=True, blank=True)

    fund_cost = models.DecimalField("Цена позиции ГПЗ за счет средств внебюджетных фондов на goszakupki.by", max_digits=15, decimal_places=2, default=0)
    inner_cost = models.DecimalField("Цена позиции ГПЗ за счет средств собственных средств на goszakupki.by",max_digits=15, decimal_places=2, default=0)
    val_currency = models.CharField("Валюта позиции ГПЗ на goszakupki.by", max_length=3, choices=CurrencyTypes.choices, default=CurrencyTypes.BYN)
    procedure_months = models.JSONField("Список месяцев (от 1 до 12), в которые проводится процедура", default=list)
    is_by_organizator = models.BooleanField(verbose_name='Отметка о проведении закупки организатором на goszakupki.by', default=False)

    # changed_by = models.ForeignKey('authentication.CustomUser', on_delete=models.SET_NULL, null=True, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Пункт плана закупки"
        verbose_name_plural = "Пункты плана закупок"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.plan.num} (v{self.version_number}) {self.title[:60]}"
