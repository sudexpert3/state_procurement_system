# -*- coding: utf-8 -*-
"""
Сервисные функции страницы «Распределение лимитов» (DepartmentArticleLimit) — правится
напрямую финансистом/админом, без согласования (решение пользователя 2026-11-23, см.
docstring модели).

1. Доступный остаток доведённого держателю лимита по подстатье (решение пользователя
   2026-11-03): "в BudgetCosts также находятся лимиты-части подразделений, т.е. одна позиция
   может закупаться для разных подразделений-держателей лимитов и суммы будут соответственно
   резервироваться в лимитах каждого из подразделений". Доведённый лимит
   (DepartmentArticleLimit.amount) уменьшается на то, что уже привязано к конкретным позициям
   плана этого держателя под этой же подстатьей — PlanShare.shared_cost (ACTIVE), где
   budget_cost.internal_economic_class совпадает с подстатьёй. Та же идея, что в
   multi_year_reservation.py (видимый номинал уменьшается на уже зарезервированное), но здесь
   резервируем не по будущему году, а по уже распределённым позициям плана в рамках ТЕКУЩЕГО
   доведённого лимита держателя.
2. Доступно по статье/параграфу/году (для предупреждения о перерасходе на странице) и
   архивация предыдущей версии записи при активации новой (`activate_limit`).
"""
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Sum
from django.utils import timezone

from core.choices import PlanItemStatus
from procurement.models import ArticleQuarterlyAllocation, DepartmentArticleLimit, PlanShare, TreasuryPayment
from procurement.services.multi_year_reservation import (
    compute_prior_years_budget_costs_by_article, compute_reserved_amount_by_article,
)


def compute_reserved_by_plan_share(internal_economic_class_id, department_id, year):
    """Сумма, уже привязанная к конкретным позициям плана этого держателя под этой подстатьёй
    и годом — PlanShare.shared_cost (ACTIVE), budget_cost тоже ACTIVE. Отображается в таблице
    «Распределение лимитов» как «сумма позиций в плане»."""
    qs = PlanShare.objects.filter(
        status=PlanItemStatus.ACTIVE,
        budget_cost__status=PlanItemStatus.ACTIVE,
        budget_cost__internal_economic_class_id=internal_economic_class_id,
        budget_cost__year=year,
        department_id=department_id,
    )
    return qs.aggregate(s=Sum('shared_cost'))['s'] or Decimal('0')


def compute_available_department_limit(department_limit):
    """Остаток доведённого держателю лимита, доступный для НОВЫХ позиций плана — доведённая
    сумма минус уже зарезервированное через PlanShare под этой же подстатьёй/годом/
    держателем."""
    reserved = compute_reserved_by_plan_share(
        department_limit.internal_economic_class_id, department_limit.department_id, department_limit.year,
    )
    return department_limit.amount - reserved


def compute_paid_actual_by_department(internal_economic_class_id, department_id, year):
    """Фактическая оплата по этому внутреннему коду ЭКР в интересах этого подразделения за
    год, нетто с учётом KindOfPayment.is_refund — та же логика сопоставления, что в
    budget_execution_report.py::_paid_net_map(), но под один ключ, без построения карты по
    всем строкам отчёта (здесь нужна ровно одна пара department+internal_economic_class)."""
    qs = TreasuryPayment.objects.filter(
        departments__id=department_id, internal_economic_class_id=internal_economic_class_id,
        payment_year=year,
    )
    paid = qs.filter(kind__is_refund=False).aggregate(s=Sum('amount'))['s'] or Decimal('0')
    refunded = qs.filter(kind__is_refund=True).aggregate(s=Sum('amount'))['s'] or Decimal('0')
    return paid - refunded


def compute_available_statya_limit(functional_class_id, economic_class_id, year):
    """Сколько реально доступно для распределения по этой статье/параграфу/году — план
    Минфина (ArticleQuarterlyAllocation) минус обязательства прошлых лет. Считает ОБЕ функции
    резерва (не только compute_reserved_amount_by_article, как делал старый движок калибровки,
    см. CurrentStatus.md, запись 2026-11-21 "известный технический долг... не стал трогать") —
    та же формула, что `available_limit` в general_money_report.py."""
    article_total = ArticleQuarterlyAllocation.objects.filter(
        functional_class_id=functional_class_id, economic_class_id=economic_class_id,
        year=year, status=PlanItemStatus.ACTIVE,
    ).aggregate(s=Sum('amount'))['s'] or Decimal('0')
    prior_years_obligations = (
        compute_reserved_amount_by_article(functional_class_id, economic_class_id, year)
        + compute_prior_years_budget_costs_by_article(functional_class_id, economic_class_id, year)
    )
    return article_total - prior_years_obligations


def compute_allocated_statya_total(functional_class_id, economic_class_id, year, exclude_id=None):
    """Сумма ACTIVE записей DepartmentArticleLimit этой статьи/параграфа/года — сколько уже
    реально распределено по держателям. `exclude_id` — исключить саму правящуюся запись (её
    старое значение не должно давить само на себя при живой проверке в модалке)."""
    qs = DepartmentArticleLimit.objects.filter(
        functional_class_id=functional_class_id, economic_class_id=economic_class_id,
        year=year, status=PlanItemStatus.ACTIVE,
    )
    if exclude_id is not None:
        qs = qs.exclude(pk=exclude_id)
    return qs.aggregate(s=Sum('amount'))['s'] or Decimal('0')


def _archive_active_combo(functional_class_id, economic_class_id, internal_economic_class_id,
                           department_id, year, archived_at=None, exclude_pk=None):
    """Архивирует все ACTIVE-записи с данной связкой (параграф+статья+подстатья+держатель+
    год) — общая логика для `activate_limit()` и `edit_active_limit()` (решение пользователя
    2026-11-23/2026-11-26: при вытеснении более новой активной записью история версий
    сохраняется построчно, не перезатирается). ВАЖНО вызывать ДО сохранения новой ACTIVE-
    записи с этой же связкой — иначе `UniqueConstraint('unique_active_department_limit')`
    отклонит INSERT ещё не вытеснившей старую запись новой записи."""
    stale = DepartmentArticleLimit.objects.filter(
        functional_class_id=functional_class_id, economic_class_id=economic_class_id,
        internal_economic_class_id=internal_economic_class_id, department_id=department_id,
        year=year, status=PlanItemStatus.ACTIVE,
    )
    if exclude_pk is not None:
        stale = stale.exclude(pk=exclude_pk)
    for old in stale:
        old.status = PlanItemStatus.ARCHIVE
        old.deactivated_at = old.deactivated_at or archived_at or timezone.now().date()
        old.save(update_fields=['status', 'deactivated_at', 'changed_at'])


def activate_limit(department_limit):
    """DRAFT -> ACTIVE. Архивирует все ACTIVE-записи той же связки (статья+параграф+подстатья+
    держатель+год) — узкий, построчный аналог full-snapshot архивации, которая раньше шла
    через ChangeRequest на уровне ВСЕЙ статьи (Этап 9, _approve_department_limits, убрана
    2026-11-23): теперь, когда нет промежуточного уровня "подстатья целиком", архивировать
    весь снимок статьи сразу не имеет смысла — каждая запись версионируется независимо
    (решение пользователя 2026-11-23: кнопка "Активировать" "делает архивными все записи-
    лимиты выбранного подразделения по выбранному Параграф-статье ЭКР и выбранному
    внутреннему коду ЭКР"). Перерасход НЕ блокирует активацию — только предупреждение на
    фронте (см. compute_available_statya_limit/compute_allocated_statya_total)."""
    if department_limit.status != PlanItemStatus.DRAFT:
        raise ValidationError('Активировать можно только черновик.')

    with transaction.atomic():
        _archive_active_combo(
            department_limit.functional_class_id, department_limit.economic_class_id,
            department_limit.internal_economic_class_id, department_limit.department_id,
            department_limit.year, exclude_pk=department_limit.pk,
        )
        department_limit.status = PlanItemStatus.ACTIVE
        department_limit.save()

    return department_limit


# Поля, переносимые на новую запись при версионировании изменения суммы (см.
# edit_active_limit) — всё, что составляет "содержимое" лимита, кроме служебных
# (status/created_at/changed_at) и deactivated_at (у новой ACTIVE-записи он пустой).
_VERSIONED_FIELDS = (
    'functional_class', 'economic_class', 'internal_economic_class', 'department',
    'year', 'amount', 'note', 'effective_date',
)


def edit_active_limit(instance, validated_data):
    """Правка ACTIVE-записи (решение пользователя 2026-11-26, задача «корректировка
    действующего лимита»):
    - если новая `amount` совпадает с текущей — правим запись НА МЕСТЕ, включая статью/
      параграф/подразделение/подстатью/примечание: это исправление ошибочно выбранного
      поля, а не новая финансовая версия лимита;
    - если `amount` меняется (сам по себе или вместе с другими полями — решение
      пользователя: смешанный случай версионируется целиком, не разбивается на два шага) —
      старая запись архивируется, новая ACTIVE создаётся со ВСЕМИ новыми значениями: смена
      суммы — финансовое событие, обязано оставлять след в истории версий лимита.
    Перерасход не блокирует (см. activate_limit) — только коллизия уникальности ACTIVE-
    связки (параграф+статья+подстатья+держатель+год) возвращает понятную ValidationError
    вместо голого IntegrityError."""
    if instance.status != PlanItemStatus.ACTIVE:
        raise ValidationError('Такая правка доступна только для действующей (ACTIVE) записи.')

    new_amount = validated_data.get('amount', instance.amount)
    amount_changed = Decimal(new_amount) != Decimal(instance.amount)

    if not amount_changed:
        for field, value in validated_data.items():
            setattr(instance, field, value)
        try:
            instance.full_clean()
        except ValidationError as exc:
            raise ValidationError(exc.messages)
        try:
            with transaction.atomic():
                instance.save()
        except IntegrityError:
            raise ValidationError(
                'Запись с такой связкой параграф+статья+подстатья+подразделение+год уже '
                'активна. Измените один из этих параметров или архивируйте старую запись.'
            )
        return instance

    archived_at = validated_data.get('deactivated_at') or timezone.now().date()
    new_kwargs = {field: getattr(instance, field) for field in _VERSIONED_FIELDS}
    new_kwargs.update({
        field: value for field, value in validated_data.items() if field in _VERSIONED_FIELDS
    })

    with transaction.atomic():
        instance.status = PlanItemStatus.ARCHIVE
        instance.deactivated_at = archived_at
        instance.save(update_fields=['status', 'deactivated_at', 'changed_at'])

        # Архивировать ВСЕ ACTIVE-записи новой связки (включая саму `instance`, которую мы
        # уже только что архивировали выше — exclude_pk здесь не нужен) ДО вставки новой
        # ACTIVE-записи — иначе UniqueConstraint отклонит INSERT, если новая связка совпала с
        # другой уже существующей активной записью (смешанный случай: сумма+подразделение/
        # статья меняются одновременно).
        _archive_active_combo(
            new_kwargs['functional_class'].pk, new_kwargs['economic_class'].pk,
            new_kwargs['internal_economic_class'].pk, new_kwargs['department'].pk,
            new_kwargs['year'], archived_at=archived_at,
        )

        new_record = DepartmentArticleLimit(status=PlanItemStatus.ACTIVE, **new_kwargs)
        try:
            new_record.full_clean(validate_unique=True)
        except ValidationError as exc:
            raise ValidationError(exc.messages)
        new_record.save()

    return new_record
