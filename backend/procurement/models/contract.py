import datetime
from django.core.exceptions import ValidationError
from django.db import models

from .supplier import Supplier
from .buyer import Buyer
from .planShare import PlanShare
from .procurementMethodDetail import ProcurementMethodDetail
from procurement.services import get_current_year, get_current_date


class Contract(models.Model):
    """Единый договор (Шапка)"""
    number = models.CharField("Номер договора", max_length=64)
    contract_date = models.DateField("Дата заключения договора", db_index=True, default=get_current_date)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="contracts",
                                 verbose_name="Исполнитель/Поставщик")
    total_cost = models.DecimalField("Общая сумма договора", max_digits=15, decimal_places=2)
    buyer = models.ForeignKey(Buyer, on_delete=models.PROTECT, related_name='buyer_contracts', verbose_name="Закупщик",
                              null=True, blank=True)
    parent_contract = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True,
                                        related_name='main_agreements',
                                        verbose_name="Основной договор (для Доп. соглашений)")
    is_registered_in_treasury = models.BooleanField("Регистрация в территориальном казначействе", default=False,
                                                    db_index=True)
    payment_terms = models.CharField("Условия оплаты", max_length=2048, null=True, blank=True)
    planned_delivery_date = models.DateField("Плановая дата поставки / выполнения работ / оказания услуг",
                                             db_index=True)
    notice = models.TextField("Примечание / Дополнительная информация", blank=True, null=True)
    fixed_assets_plan_item = models.CharField("Пункт перечня плана основных средств", max_length=255, blank=True,
                                              null=True)
    procurement_method_detail = models.ForeignKey(ProcurementMethodDetail,
                                                  on_delete=models.PROTECT,
                                                  related_name='contracts',
                                                  verbose_name="Вид процедуры закупки (Пункт)", null=True, blank=True,
                                                  help_text="Выбор конкретного пункта процедуры из ведомственного справочника РБ")
    construction_type = models.CharField("Вид строительных работ / Объект строительства", max_length=2048, null=True,
                                         blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Договор"
        verbose_name_plural = "Реестр договоров"
        ordering = ['-contract_date', '-created_at']

    def __str__(self):
        prefix = "ДС к договору" if self.parent_contract_id else "Договор"
        supplier_info = f"({self.supplier.name})" if self.supplier else ''
        return f"{prefix} № {self.number} от {self.contract_date} {supplier_info} ({self.total_cost} BYN)"

    def clean(self):
        super().clean()
        # Защитная логика: Дополнительное соглашение не может ссылаться на самого себя
        if self.parent_contract_id and self.pk and self.parent_contract_id == self.pk:
            raise ValidationError({'parent_contract': "Дополнительное соглашение не может ссылаться на самого себя."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def days_remaining(self) -> int:
        """Рассчитывает количество дней, оставшихся до планового окончания срока обязательств"""
        today = datetime.date.today()
        if self.planned_delivery_date < today:
            return 0  # Срок уже истек (просрочка)
        return (self.planned_delivery_date - today).days

    @property
    def is_urgent_warning(self) -> bool:
        """Флаг критического срока: осталось менее 5 дней до окончания исполнения обязательств"""
        remaining = self.days_remaining
        # Если срок еще не вышел, но дней осталось больше нуля и меньше либо равно 5
        return 0 < remaining <= 5

    def get_quarterly_finance(self):
        """Реальные (не прогнозные) план/факт по кварталам, просуммированные по всем строкам
        договора (всем contract_item, включая "сводную" запись с contract_item=None) —
        никакой придуманной математики переноса остатков, только то, что есть в БД
        (см. ContractQuarterlyFinance, Этап 4.3 — ручная корректировка планового значения
        специалистом вместо автоматического прогноза)."""
        from django.db.models import Sum
        records = self.quarterly_finances.values('year', 'quarter').annotate(
            planned_cost=Sum('planned_cost'), actual_cost=Sum('actual_cost'),
        ).order_by('year', 'quarter')
        return list(records)
    #     # Корректировка IV квартала: жесткая увязка "Остаток от договора"
    #     spent_q1_q3 = result['Q1']['actual_spent'] + result['Q2']['actual_spent'] + result['Q3']['dynamic_forecast']
    #     result['Q4']['dynamic_forecast'] = round(total_contract_cost - spent_q1_q3, 2)
    #
    #     return result


class ContractItem(models.Model):
    """Спецификация договора (Строки списания лимитов)"""
    contract = models.ForeignKey(Contract, on_delete=models.PROTECT, related_name='items')
    title = models.CharField("Наименование позиции, как в договоре", max_length=2048, null=True, blank=True)
    year = models.PositiveIntegerField("Год позиции договора", db_index=True, default=get_current_year)
    plan_share = models.ForeignKey(PlanShare, on_delete=models.PROTECT, related_name='contract_items')
    contract_amount = models.DecimalField("Количество по договору", max_digits=12, decimal_places=3)
    contract_cost = models.DecimalField("Сумма по договору", max_digits=15, decimal_places=2)

    class Meta:
        verbose_name = "Спецификация к договору"
        verbose_name_plural = "Спецификация к договору"
        ordering = ['-year', '-id']
