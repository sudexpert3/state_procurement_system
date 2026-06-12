import datetime
from django.utils import timezone
from django.core.exceptions import ValidationError
from django.db import models

from .buyer import Buyer
from .planShare import PlanShare
from .procurementMethodDetail import ProcurementMethodDetail


class Supplier(models.Model):
    """Справочник поставщиков и исполнителей Республики Беларусь (Контрагенты)"""
    name = models.CharField("Наименование организации", max_length=512)
    unp = models.CharField("УНП", max_length=16, unique=True, db_index=True)

    class Meta:
        verbose_name = "Поставщик"
        verbose_name_plural = "Справочник поставщиков"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} (УНП: {self.unp})"


class Contract(models.Model):
    """Единый договор (Шапка)"""
    number = models.CharField("Номер договора", max_length=64)
    contract_date = models.DateField("Дата заключения договора", db_index=True, default=timezone.now)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="contracts", verbose_name="Исполнитель/Поставщик")
    total_cost = models.DecimalField("Общая сумма договора", max_digits=15, decimal_places=2)
    buyer = models.ForeignKey(Buyer, on_delete=models.PROTECT, related_name='buyer_contracts', verbose_name="Закупщик", null=True, blank=True)
    parent_contract = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='main_agreements', verbose_name="Основной договор (для Доп. соглашений)")
    is_registered_in_treasury = models.BooleanField("Регистрация в территориальном казначействе", default=False, db_index=True)
    payment_terms = models.CharField("Условия оплаты", max_length=2048, null=True, blank=True)
    planned_delivery_date = models.DateField("Плановая дата поставки / выполнения работ / оказания услуг", db_index=True)
    notice = models.TextField("Примечание / Дополнительная информация", blank=True, null=True)
    fixed_assets_plan_item = models.CharField("Пункт перечня плана основных средств", max_length=255, blank=True, null=True)
    procurement_method_detail = models.ForeignKey(ProcurementMethodDetail, on_delete=models.PROTECT, related_name='contracts',
        verbose_name="Вид процедуры закупки (Пункт)", null=True, blank=True, help_text="Выбор конкретного пункта процедуры из ведомственного справочника РБ")
    construction_type = models.CharField("Вид строительных работ / Объект строительства", max_length=2048, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Договор"
        verbose_name_plural = "Реестр договоров"
        ordering = ['-contract_date', '-created_at']

    def __str__(self):
        prefix = "ДС к договору" if self.parent_contract_id else "Договор"
        return f"{prefix} № {self.number} от {self.contract_date} ({self.total_cost} BYN)"

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


    def get_quarterly_analytics(self, target_year: int):
        """
        Возвращает полную картину по кварталам: Первоначальный план, Факт и Динамический перенос остатков.
        Идеально подходит для вывода в дополнительную таблицу на фронтенде.
        """
        # 1. Получаем все существующие записи квартального финансирования из БД
        db_records = {rec.quarter: rec for rec in self.quarterly_finances.filter(year=target_year)}

        total_contract_cost = self.total_cost
        quarters = ['Q1', 'Q2', 'Q3', 'Q4']

        # Базовое (первоначальное) распределение, если записей еще нет — делим поровну
        base_equal_share = total_contract_cost / 4

        result = {}
        accumulated_economy = 0  # Сюда собирается недорасходованный остаток из прошлых кварталов

        for q in quarters:
            record = db_records.get(q)

            # Извлекаем данные из базы или берем дефолты
            init_plan = record.planned_cost if record else base_equal_share
            fact = record.actual_cost if record else 0

            # ВЫЧИСЛЕНИЕ ДИНАМИЧЕСКОГО ПРОГНОЗА (Бизнес-логика ГКСЭ):
            if q in ['Q1', 'Q2']:
                # Для прошедших кварталов планируемый расход равен фактическому,
                # а остаток уходит в экономию для перераспределения
                forecast_plan = fact
                accumulated_economy += (init_plan - fact)
            elif q == 'Q3':
                # Для текущего (3-го) квартала: ставим базовый план + забираем ВСЮ накопленную экономию
                forecast_plan = init_plan + accumulated_economy
                accumulated_economy = 0  # Обнуляем, так как всё перенесли в Q3
            else:
                # Для 4-го квартала: забираем остаток от договора за вычетом всех расходов
                # (Точно соответствует вашей фразе "оставшуюся от договора сумму")
                forecast_plan = init_plan  # Базовый ориентир

            result[q] = {
                "initial_plan": round(init_plan, 2),
                "actual_spent": round(fact, 2),
                "dynamic_forecast": round(forecast_plan, 2)
            }

        # Корректировка IV квартала: жесткая увязка "Остаток от договора"
        spent_q1_q3 = result['Q1']['actual_spent'] + result['Q2']['actual_spent'] + result['Q3']['dynamic_forecast']
        result['Q4']['dynamic_forecast'] = round(total_contract_cost - spent_q1_q3, 2)

        return result



class ContractItem(models.Model):
    """Спецификация договора (Строки списания лимитов)"""
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='items')
    year = models.PositiveIntegerField("Год позиции договора", db_index=True, default=timezone.now().year)
    # ЖЕСТКАЯ СВЯЗЬ С ДОЛЕЙ ПОДРАЗДЕЛЕНИЯ ИЗ ПЛАНА!
    plan_share = models.ForeignKey(PlanShare, on_delete=models.PROTECT, related_name='contract_items')
    # Списание конкретно под это подразделение
    contract_amount = models.DecimalField("Количество по договору", max_digits=12, decimal_places=3)  # 100 для ГУСЭ / 53 для ГУСМЭ
    contract_cost = models.DecimalField("Сумма по договору", max_digits=15, decimal_places=2)  # 48000 для ГУСЭ / 24000 для ГУСМЭ

    class Meta:
        verbose_name = "Спецификация к договору"
        verbose_name_plural = "Спецификация к договору"
        ordering = ['-year', '-id']

