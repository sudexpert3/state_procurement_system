from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.utils import timezone
from .contract import Contract


class TreasuryPayment(models.Model):
    """Фактические оплаты по договору (Платежные поручения казначейства)"""
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='payments', verbose_name="Договор")
    payment_number = models.CharField("Номер платежного поручения", max_length=32, blank=True, null=True, help_text="Внутренний номер платежки из системы Клиент-ТК Минфина")
    payment_date = models.DateField("Дата оплаты", db_index=True, default=timezone.now())
    amount = models.DecimalField("Сумма оплаты", max_digits=15, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Платежное поручение"
        verbose_name_plural = "Реестр фактических оплат (Платежки)"
        ordering = ['-payment_date', '-created_at']

    def __str__(self):
        return f"Платежка от {self.payment_date} на сумму {self.amount} BYN"

    def clean(self):
        super().clean()

        # 1. Валидация: сумма оплаты не может быть отрицательной или нулевой
        if self.amount <= 0:
            raise ValidationError({'amount': "Сумма фактической оплаты должна быть больше нуля."})

        # 2. Превентивный казначейский контроль перерасхода по договору
        if self.contract_id:
            query = TreasuryPayment.objects.filter(contract_id=self.contract_id)
            if self.pk:
                query = query.exclude(pk=self.pk)

            already_paid = query.aggregate(models.Sum('amount'))['amount__sum'] or 0
            if already_paid + self.amount > self.contract.total_cost:
                excess = (already_paid + self.amount) - self.contract.total_cost
                raise ValidationError({
                    'amount': f"Казначейский перерасход! Общая сумма договора: {self.contract.total_cost} BYN. "
                              f"Уже оплачено: {already_paid} BYN. Данный платеж вызовет превышение на {excess} BYN."
                })

    def save(self, *args, **kwargs):
        self.full_clean()

        # Запускаем атомарную транзакцию для безопасного пересчета квартальных балансов
        with transaction.atomic():
            super().save(*args, **kwargs)

            # Автоматически вычисляем квартал на основе переданной даты
            month = self.payment_date.month
            year = self.payment_date.year

            if month in [1, 2, 3]:
                q_code = 'Q1'
            elif month in [4, 5, 6]:
                q_code = 'Q2'
            elif month in [7, 8, 9]:
                q_code = 'Q3'
            else:
                q_code = 'Q4'

            # Импортируем смежную модель кварталов напрямую (избегая циклов)
            from .contractQuarterlyFinance import ContractQuarterlyFinance

            # Находим или создаем строку кассового плана для этого квартала
            q_finance, created = ContractQuarterlyFinance.objects.get_or_create(contract=self.contract, quarter=q_code, year=year)

            # Пересчитываем ВСЕ платежки этого договора за данный квартал
            total_q_fact = TreasuryPayment.objects.filter(contract=self.contract,
                                                          payment_date__year=year,
                                                          payment_date__month__in=[
                                                              (1, 2, 3) if q_code == 'Q1' else
                                                              (4, 5, 6) if q_code == 'Q2' else
                                                              (7, 8, 9) if q_code == 'Q3' else (10, 11, 12)
                                                          ][0]
                                                          ).aggregate(models.Sum('amount'))['amount__sum'] or 0

            # Обновляем агрегированное поле фактического расхода в квартальной таблице
            q_finance.actual_cost = total_q_fact
            q_finance.save()
