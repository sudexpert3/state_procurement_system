from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import models, transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .contract import Contract
from .department import Department
from procurement.services import get_current_date, get_current_year, decoder_iec
from procurement.models import (InternalEconomicClassifier, ExternalEconomicCode, FunctionalCode, ProgramCode)
from core.choices import QuarterTypes


class KindOfPayment(models.Model):
    name = models.CharField("Название типа платежа", max_length=1024, unique=True)
    # Знак влияния на фактический расход: обычный платёж увеличивает кассовый расход
    # (False), возврат/восстановление кассовых расходов — уменьшает (True). TreasuryPayment.amount
    # всегда хранится положительным (см. clean()) — направление задаёт именно вид платежа,
    # а не знак суммы. Нужно для будущей аналитики "факт по статье/держателю лимита"
    # (см. CurrentStatus.md, Этап 4.4) и для превентивного контроля перерасхода по договору
    # (см. TreasuryPayment.clean() — учитывает возвраты со знаком минус).
    is_refund = models.BooleanField(
        "Уменьшает фактический расход (возврат / восстановление кассовых расходов)",
        default=False,
    )

    class Meta:
        verbose_name = "Тип платежа"
        verbose_name_plural = "Типы платежей"
        ordering = ['id']

    def __str__(self):
        return f"{self.name}"


class TreasuryPayment(models.Model):
    """Фактические оплаты по договору (Платежные поручения казначейства)"""
    contract = models.ForeignKey(Contract, on_delete=models.PROTECT, related_name='treasury_payments',
                                 verbose_name="Договор", null=True, blank=True)
    quarter = models.CharField("Квартал", max_length=2, choices=QuarterTypes.choices, default=QuarterTypes.Q1,
                               db_index=True)
    payment_number = models.CharField("Номер платежного поручения", max_length=32, blank=True, null=True,
                                      help_text="Внутренний номер платежки из системы Клиент-ТК Минфина")
    payment_year = models.IntegerField("Финансовый год", db_index=True, default=get_current_year)
    payment_date = models.DateField("Дата осуществления платежа", db_index=True, default=get_current_date)
    save_date = models.DateField("Дата разнесения платежа", db_index=True, default=get_current_date)
    created_at = models.DateTimeField('Дата_время первого сохранения', auto_now_add=True)
    changed_at = models.DateTimeField('Дата_время последнего изменения', auto_now=True)

    amount = models.DecimalField("Сумма оплаты", max_digits=15, decimal_places=2, default=0)
    kind = models.ForeignKey(KindOfPayment, on_delete=models.PROTECT, related_name='treasury_payments',
                             verbose_name="Вид платежа", default=1, null=True, blank=True)
    notice = models.CharField("Примечание", max_length=1024, blank=True, null=True, help_text="Примечание")


    internal_economic_class = models.ForeignKey(InternalEconomicClassifier,
                                                on_delete=models.PROTECT,
                                                related_name='treasury_payments',
                                                verbose_name="Экономический код расходов (ЭКР)",
                                                blank=True, null=True
                                                )
    internal_economic_section = models.ForeignKey(InternalEconomicClassifier, on_delete=models.PROTECT, related_name='section_treasury_payments', null=True, blank=True, verbose_name="Раздел (Уровень 1)")
    internal_economic_subsection = models.ForeignKey(InternalEconomicClassifier, on_delete=models.PROTECT, related_name='subsection_treasury_payments', null=True, blank=True, verbose_name="Подраздел (Уровень 2)")
    internal_economic_kind = models.ForeignKey(InternalEconomicClassifier, on_delete=models.PROTECT, related_name='kind_treasury_payments', null=True, blank=True, verbose_name="Вид (Уровень 3)")
    internal_economic_article = models.ForeignKey(InternalEconomicClassifier, on_delete=models.PROTECT, related_name='article_treasury_payments', null=True, blank=True, verbose_name="Статья (Уровень 4)")


    economic_class = models.ForeignKey(ExternalEconomicCode,
                                       on_delete=models.PROTECT,
                                       related_name="treasury_payments",
                                       verbose_name="Внешний код ЭКР",
                                       null=True, blank=True
                                       )

    functional_class = models.ForeignKey(FunctionalCode,
                                         on_delete=models.PROTECT,
                                         related_name="treasury_payments",
                                         verbose_name="Функциональная классификация",
                                         null=True, blank=True
                                         )

    program_class = models.ForeignKey(ProgramCode,
                                      on_delete=models.PROTECT,
                                      related_name="treasury_payments",
                                      verbose_name="Программная классификация",
                                      null=True, blank=True, default=3,
                                      )

    # Подразделения, на лимиты которых относится платёж — для оперативного учёта расходования
    # лимитов по статьям/подразделениям без платежа, привязанного к конкретному PlanShare
    # (напр. "не публ.часть. Административная процедура"/"Ежегодный свободный платеж" — платёж
    # без позиции плана, подразделения берутся прямо из колонки W реестра). Для платежей, уже
    # связанных через contract_item с PlanShare, это поле дублирует department оттуда —
    # сознательная денормализация для быстрой выборки в отчётах "лимит/факт по подразделению"
    # без join ContractItem -> PlanShare -> Department (решение пользователя, 2026-10-26).
    departments = models.ManyToManyField(Department, related_name='treasury_payments',
                                         verbose_name="Подразделения (для оперативного учёта)",
                                         blank=True)

    class Meta:
        verbose_name = "Платежное поручение"
        verbose_name_plural = "Реестр фактических оплат (Платежки)"
        ordering = ['-payment_date', '-created_at']

    def __str__(self):
        return f"Разнесено: {self.payment_date} на сумму {self.amount} BYN"

    def clean(self):
        super().clean()

        # 1. Валидация: сумма оплаты не может быть отрицательной или нулевой
        if self.amount <= 0:
            raise ValidationError({'amount': "Сумма фактической оплаты должна быть больше нуля."})

        # 2. Превентивный казначейский контроль перерасхода по договору.
        # Считаем НЕТТО: обычные платежи складываем, возвраты/восстановления кассовых
        # расходов (kind.is_refund=True) вычитаем — иначе перенос переплаты одного квартала
        # с последующим возвратом в другом (amount всегда положительный, направление задаёт
        # вид платежа) ложно давал бы перерасход при простом суммировании всех amount подряд.
        if self.contract_id:
            query = TreasuryPayment.objects.filter(contract_id=self.contract_id)
            if self.pk:
                query = query.exclude(pk=self.pk)

            paid = query.filter(kind__is_refund=False).aggregate(models.Sum('amount'))['amount__sum'] or 0
            refunded = query.filter(kind__is_refund=True).aggregate(models.Sum('amount'))['amount__sum'] or 0
            already_paid = paid - refunded

            self_signed = -self.amount if (self.kind_id and self.kind.is_refund) else self.amount
            net_total = already_paid + self_signed

            if net_total > self.contract.total_cost:
                excess = net_total - self.contract.total_cost
                raise ValidationError({
                    'amount': f"Казначейский перерасход! Общая сумма договора: {self.contract.total_cost} BYN. "
                              f"Уже оплачено нетто (с учётом возвратов): {already_paid} BYN. Данный платеж вызовет "
                              f"превышение на {excess} BYN."
                })

    def save(self, *args, **kwargs):
        self.full_clean()

        """Автоматическая привязка к существующим родительским статьям ЭКР при сохранении"""
        if self.internal_economic_class:
            section_id, subsection_id, kind_id, article_id = decoder_iec(self.internal_economic_class)

            if section_id:
                self.internal_economic_section_id = section_id
            if subsection_id:
                self.internal_economic_subsection_id = subsection_id
            if kind_id:
                self.internal_economic_kind_id = kind_id
            if article_id:
                self.internal_economic_article_id = article_id

        # Автоматически вычисляем квартал на основе даты платежа — ДО сохранения (это чистая
        # функция от self.payment_date, не требует записи в БД).
        # Было: сохранение ДВАЖДЫ (внутри transaction.atomic(), затем ещё раз после) —
        # второй вызов передавал те же *args/**kwargs, включая force_insert=True при
        # создании через .objects.create(), и пытался повторно ВСТАВИТЬ уже сохранённую
        # строку с тем же id -> IntegrityError "duplicate key". Не проявлялось раньше,
        # потому что TreasuryPayment.objects.create() ранее не вызывался в коде проекта.
        month = self.payment_date.month
        if month in [1, 2, 3]:
            self.quarter = QuarterTypes.Q1
        elif month in [4, 5, 6]:
            self.quarter = QuarterTypes.Q2
        elif month in [7, 8, 9]:
            self.quarter = QuarterTypes.Q3
        else:
            self.quarter = QuarterTypes.Q4

        with transaction.atomic():
            super().save(*args, **kwargs)
            # Этап 4.3: автоматический пересчёт факта квартального плана договора по
            # платёжкам — только "сводную" (без разбивки по строке/подразделению,
            # contract_item=None) запись, не трогая исторические contract_item-записи,
            # перенесённые при переносе rd26.xlsx. В одной транзакции с платежом — чтобы
            # ошибка пересчёта (напр. превышение суммы договора) откатила и сам платёж.
            if self.contract_id:
                _recompute_contract_quarter_actual(self.contract, self.quarter, self.payment_year)

def _recompute_contract_quarter_actual(contract, quarter, year):
    """Пересчитывает "сводную" (contract_item=None — весь договор целиком, без разбивки по
    подразделению) запись ContractQuarterlyFinance по факту из TreasuryPayment (нетто, с
    учётом KindOfPayment.is_refund). Не трогает contract_item-записи, созданные при переносе
    rd26.xlsx (у них своя, более детальная история по подразделениям) — это отдельный,
    параллельный разрез для платежей, заводимых напрямую через API (Этап 4.3)."""
    paid = TreasuryPayment.objects.filter(
        contract=contract, quarter=quarter, payment_year=year, kind__is_refund=False,
    ).aggregate(s=models.Sum('amount'))['s'] or Decimal('0')
    refunded = TreasuryPayment.objects.filter(
        contract=contract, quarter=quarter, payment_year=year, kind__is_refund=True,
    ).aggregate(s=models.Sum('amount'))['s'] or Decimal('0')
    net = paid - refunded

    from .contractQuarterlyFinance import ContractQuarterlyFinance
    cqf = ContractQuarterlyFinance.objects.filter(
        contract=contract, contract_item__isnull=True, quarter=quarter, year=year,
    ).first()
    if cqf:
        if cqf.actual_cost != net:
            cqf.actual_cost = net
            cqf.save(update_fields=['actual_cost'])
    elif net:
        ContractQuarterlyFinance.objects.create(
            contract=contract, contract_item=None, quarter=quarter, year=year,
            planned_cost=net, actual_cost=net,
        )


@receiver(post_delete, sender=TreasuryPayment)
def _on_treasury_payment_deleted(sender, instance, **kwargs):
    """Удаление платёжки тоже должно уменьшить пересчитанный факт — иначе он "зависнет"
    задвоенным после удаления ошибочно введённого платежа."""
    if instance.contract_id:
        _recompute_contract_quarter_actual(instance.contract, instance.quarter, instance.payment_year)
