# -*- coding: utf-8 -*-
"""
Отчёт «Общие деньги» (первый из серии отчётов — решение пользователя 2026-11-03,
дальнейшие отчёты добавляются отдельными модулями/эндпоинтами с тем же подходом:
статья = (functional_class, economic_class) — та же гранулярность, что у
ArticleQuarterlyAllocation, единственный источник "планового назначения" (Минфин видит
только укрупнённую статью, не разбивку по подразделениям/позициям плана).

Столбцы и формулы (ровно как сформулировал пользователь 2026-11-03, плюс один столбец,
добавленный тем же сообщением):

  planned_annual            — плановое назначение на год по статье: сумма
                               ArticleQuarterlyAllocation.amount по кварталам.
  prior_years_obligations   — принятые обязательства прошлых лет: многолетние договоры,
                               заключённые до report year, но финансирование которых
                               приходится на report year (см. multi_year_reservation.py).
  allocated_limit           — доведённые лимиты: сумма подстатей DepartmentArticleLimit
                               (department IS NULL) этой статьи/года — то, что финансист
                               уже разбил по подстатьям (калибровка, см. change_requests.py
                               DEPARTMENT_LIMIT_CALIBRATION).
  unassigned_limit          — нераспределённые лимиты: planned_annual - prior_years_obligations
                               - allocated_limit (деньги статьи, которые Минфин выделил, но
                               финансист ещё не довёл НИ ПО ОДНОЙ подстатье).
  entered_into_plan         — внесено в ГПЗ (публикуемая + непубликуемая часть): сумма
                               BudgetCosts.cost этой статьи/года, без фильтра по is_public.
  committed_obligations     — принято обязательств (текущего года): сумма ContractItem.
                               contract_cost, где и ContractItem.year, и его budget_cost.year
                               равны report year (обязательства "родные" для этого года, не
                               те, что уже посчитаны в prior_years_obligations).
  paid_actual               — фактическая оплата: сумма TreasuryPayment нетто (с учётом
                               KindOfPayment.is_refund) за report year, сопоставленная со
                               статьёй — см. _paid_actual().
  unallocated_limit         — остаток незапланированных средств: allocated_limit -
                               entered_into_plan (доведено подразделениям, но ещё не привязано
                               ни к одной конкретной позиции плана).
  remainder_unobligated     — остаток от принятых обязательств: planned_annual -
                               committed_obligations - prior_years_obligations.
  remainder_with_actual     — остаток с учётом фактических расходов: planned_annual -
                               paid_actual (добавлено пользователем 2026-11-03).
"""
from decimal import Decimal

from django.db.models import Q, Sum

from core.choices import PlanItemStatus
from procurement.models import (
    ArticleQuarterlyAllocation, BudgetCosts, ContractItem, DepartmentArticleLimit, TreasuryPayment,
)
from procurement.services.multi_year_reservation import compute_reserved_amount_by_article


def compute_general_money_report(year):
    """Возвращает ПЛОСКИЙ список строк — одна строка на статью (functional_class+
    economic_class), без разбивки по подразделениям (это org-wide отчёт; разбивка по
    держателям лимита — отдельный уже существующий отчёт, см. budget_execution_report.py,
    Этап 4.4)."""
    # .order_by() явно сбрасывает дефолтную сортировку модели (['year', 'quarter']) — иначе
    # 'quarter' (не входящий в values()) просачивается в ORDER BY и ломает схлопывание DISTINCT
    # по (functional_class, economic_class), давая по строке на КАЖДЫЙ квартал вместо одной.
    articles = ArticleQuarterlyAllocation.objects.filter(
        year=year, status=PlanItemStatus.ACTIVE,
    ).order_by().values('functional_class_id', 'economic_class_id').distinct()

    return [_compute_row(a['functional_class_id'], a['economic_class_id'], year) for a in articles]


def _compute_row(functional_class_id, economic_class_id, year):
    allocation_qs = ArticleQuarterlyAllocation.objects.filter(
        functional_class_id=functional_class_id, economic_class_id=economic_class_id,
        year=year, status=PlanItemStatus.ACTIVE,
    )
    sample = allocation_qs.select_related('functional_class', 'economic_class').first()
    planned_annual = allocation_qs.aggregate(s=Sum('amount'))['s'] or Decimal('0')

    prior_years_obligations = compute_reserved_amount_by_article(functional_class_id, economic_class_id, year)

    allocated_limit = DepartmentArticleLimit.objects.filter(
        functional_class_id=functional_class_id, economic_class_id=economic_class_id,
        year=year, department__isnull=True, status=PlanItemStatus.ACTIVE,
    ).aggregate(s=Sum('amount'))['s'] or Decimal('0')

    entered_into_plan = BudgetCosts.objects.filter(
        functional_class_id=functional_class_id, economic_class_id=economic_class_id,
        year=year, status=PlanItemStatus.ACTIVE,
    ).aggregate(s=Sum('cost'))['s'] or Decimal('0')

    committed_obligations = ContractItem.objects.filter(
        year=year,
        plan_share__status=PlanItemStatus.ACTIVE,
        plan_share__budget_cost__status=PlanItemStatus.ACTIVE,
        plan_share__budget_cost__functional_class_id=functional_class_id,
        plan_share__budget_cost__economic_class_id=economic_class_id,
        plan_share__budget_cost__year=year,
    ).aggregate(s=Sum('contract_cost'))['s'] or Decimal('0')

    paid_actual = _paid_actual(functional_class_id, economic_class_id, year)

    return {
        'functional_class_id': functional_class_id,
        'economic_class_id': economic_class_id,
        'functional_code': sample.functional_class.code_api if sample else None,
        'economic_code': sample.economic_class.code_api if sample else None,
        'economic_description': sample.economic_class.description if sample else None,
        'year': year,
        'planned_annual': planned_annual,
        'prior_years_obligations': prior_years_obligations,
        'allocated_limit': allocated_limit,
        'unassigned_limit': planned_annual - prior_years_obligations - allocated_limit,
        'entered_into_plan': entered_into_plan,
        'committed_obligations': committed_obligations,
        'paid_actual': paid_actual,
        'unallocated_limit': allocated_limit - entered_into_plan,
        'remainder_unobligated': planned_annual - committed_obligations - prior_years_obligations,
        'remainder_with_actual': planned_annual - paid_actual,
    }


def _paid_actual(functional_class_id, economic_class_id, year):
    """Фактическая оплата по статье за год, нетто с учётом KindOfPayment.is_refund.

    Для платежей, привязанных к договору (contract_id), экономический/функциональный код
    на самой TreasuryPayment почти никогда не заполнен (проверено на реальных данных —
    только у "свободных" платёжек) — сопоставление идёт через internal_economic_class
    (заполнен у подавляющего большинства платежей), а статья->подстатьи устанавливается
    через BudgetCosts этой же статьи/года. Для "свободных" платёжек (без договора),
    у которых economic_class/functional_class заполнены напрямую, добавляем прямое
    сопоставление через OR — иначе часть свободных платёжек без internal_economic_class
    была бы пропущена (на реальных данных — 3 из 17, проверено 2026-11-03)."""
    internal_ids = BudgetCosts.objects.filter(
        functional_class_id=functional_class_id, economic_class_id=economic_class_id,
        year=year, status=PlanItemStatus.ACTIVE, internal_economic_class__isnull=False,
    ).values_list('internal_economic_class_id', flat=True).distinct()

    qs = TreasuryPayment.objects.filter(payment_year=year).filter(
        Q(internal_economic_class_id__in=list(internal_ids))
        | Q(economic_class_id=economic_class_id, functional_class_id=functional_class_id)
    )

    paid = qs.filter(kind__is_refund=False).aggregate(s=Sum('amount'))['s'] or Decimal('0')
    refunded = qs.filter(kind__is_refund=True).aggregate(s=Sum('amount'))['s'] or Decimal('0')
    return paid - refunded
