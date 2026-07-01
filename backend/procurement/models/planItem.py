from datetime import datetime
from django.db import models, transaction
from django.conf import settings
from core.choices import ProcurementItemTypes, CurrencyTypes, PlanItemStatus
from .okrbProduct import OkrbProduct
from .unitOfMeasurement import UnitOfMeasurement
from .purchases import Purchases


class ClosedPlanSequence(models.Model):
    """
    Служебный атомарный счетчик для закрытых закупкок ГКСЭ.
    Защищает генерацию номеров от Race Condition и лексикографических ошибок.
    """
    year = models.PositiveIntegerField(unique=True)
    current_counter = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "Счетчик закрытых закупок"
        verbose_name_plural = "Счетчики закрытых закупок"


class PlanItem(models.Model):
    """Мастер-запись позиции ГПЗ (сквозной неизменяемый идентификатор)"""
    plan_purchase = models.ForeignKey(Purchases, on_delete=models.PROTECT)
    num = models.CharField("Регистрационный номер позиции ГПЗ на goszakupki.by", max_length=64, null=True, blank=True,
                           db_index=True)
    # Важнейший флаг для разграничения логики API и шифрования/скрытия данных
    is_public = models.BooleanField("Публикуется на goszakupki.by?", default=True, db_index=True)
    is_active = models.BooleanField("Активная позиция?", default=True, db_index=True)
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
            ),
            models.UniqueConstraint(
                fields=["num"],
                condition=models.Q(is_public=False, num__isnull=False),
                name="unique_num_for_closed_plans",
            )
        ]

    def __str__(self):
        return f"{self.num or 'БЕЗ НОМЕРА'}"

    def save(self, *args, **kwargs):
        """Атомарная генерация внутреннего номера с защитой от состояния гонки"""
        # Если позиция непубликуемая и номер еще не присвоен (например, при создании черновика)
        if not self.is_public and not self.num:
            current_year = datetime.now().year

            # Изолируем генерацию номера в атомарный блок с блокировкой строки счетчика в PostgreSQL
            with transaction.atomic():
                seq_obj, _ = ClosedPlanSequence.objects.select_for_update().get_or_create(
                    year=current_year,
                    defaults={"current_counter": 0}
                )
                # Инкрементируем счетчик на уровне БД
                seq_obj.current_counter += 1
                seq_obj.save()

                # Форматируем номер с фиксированным заполнением нулями (например: 2026-INTERNAL-00043)
                # Это гарантирует идеальную строковую сортировку в будущем
                self.num = f"{current_year}-INTERNAL-{seq_obj.current_counter:05d}"

        super().save(*args, **kwargs)


class PlanItemDetail(models.Model):
    plan_item = models.ForeignKey(PlanItem, on_delete=models.PROTECT, related_name='details')
    created_at = models.DateTimeField(auto_now_add=True)
    changed_at = models.DateTimeField(auto_now=True)
    # changed_by = models.ForeignKey('authentication.CustomUser', on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField("Статус", max_length=20, choices=PlanItemStatus.choices, default=PlanItemStatus.DRAFT,
                              db_index=True)

    purchases_item_id = models.BigIntegerField("id позиции ГПЗ на goszakupki.by", null=True, blank=True)
    purchases_id = models.BigIntegerField("Идентификатор ГПЗ на goszakupki.by", null=True, blank=True, db_index=True)
    unp_budget = models.CharField("УНП", max_length=16, db_index=True, default=settings.UNP_BUDGET)
    num = models.CharField("Регистрационный номер позиции ГПЗ на goszakupki.by", max_length=32, db_index=True)
    title = models.TextField("Наименование позиции ГПЗ на goszakupki.by")
    okrb = models.CharField("Код ОКРБ 007 позиции ГПЗ на goszakupki.by", max_length=16, db_index=True)
    okrb_title = models.TextField("Наименование позиции ГПЗ на goszakupki.by")
    # Связь со справочником ОКРБ 007 вместо сырой строки
    okrb_product = models.ForeignKey(OkrbProduct, on_delete=models.PROTECT, related_name="plan_item_versions",
                                     verbose_name="Продукция по ОКРБ 007", null=True, blank=True)
    type = models.CharField("Вид предмета закупки для позиции ГПЗ на goszakupki.by", max_length=32,
                            choices=ProcurementItemTypes.choices, default=ProcurementItemTypes.product)
    val_amount = models.DecimalField("Объем закупки позиции ГПЗ на goszakupki.by", default=0, max_digits=12,
                                     decimal_places=3)
    val_type = models.CharField("Код ОКРБ 008 позиции ГПЗ на goszakupki.by", max_length=8, db_index=True)
    val_unit = models.ForeignKey(UnitOfMeasurement, on_delete=models.PROTECT, related_name="plan_item_versions",
                                 verbose_name="Единица измерения", null=True, blank=True)

    fund_cost = models.DecimalField("Цена позиции ГПЗ за счет средств внебюджетных фондов на goszakupki.by",
                                    max_digits=15, decimal_places=2, default=0)
    inner_cost = models.DecimalField("Цена позиции ГПЗ за счет средств собственных средств на goszakupki.by",
                                     max_digits=15, decimal_places=2, default=0)
    val_currency = models.CharField("Валюта позиции ГПЗ на goszakupki.by", max_length=3, choices=CurrencyTypes.choices,
                                    default=CurrencyTypes.BYN)
    procedure_months = models.JSONField("Список месяцев (от 1 до 12), в которые проводится процедура", default=list)
    is_by_organizator = models.BooleanField(verbose_name='Отметка о проведении закупки организатором на goszakupki.by',
                                            default=False)

    class Meta:
        verbose_name = "Пункт плана закупки (детальная информация)"
        verbose_name_plural = "Пункты плана закупок (детальная информация)"
        ordering = ["-id"]

    def __str__(self):
        return f"{self.num} {self.title[:60]}"
