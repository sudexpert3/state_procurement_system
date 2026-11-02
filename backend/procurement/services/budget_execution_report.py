# -*- coding: utf-8 -*-
"""
Оперативный отчёт «назначено — обязательства — оплачено — остаток» (Этап 4.4).

Возвращает ПЛОСКИЙ список строк на самом детальном уровне (держатель лимита × статья ЭКР ×
год, опционально — квартал). Группировку/развёртку по иерархии подразделений
(`Department.parent`) и по уровням классификатора (`InternalEconomicClassifier`) делает
фронтенд — на бэкенде для этого уже есть все нужные связи, пересчитывать их в дерево здесь
было бы дублированием того, что UI и так умеет строить сам.

Формулы (решение пользователя 2026-11-02 — это два НЕЗАВИСИМЫХ столбца, не вычитаются
друг из друга):
  - allocated (выделено/назначено) — PlanShare.shared_cost (год) или сумма
    BudgetQuarterlyLimit.amount по держателю за квартал, если передан `quarter`.
  - committed_obligations (принятые обязательства) — сумма ContractItem.contract_cost по
    держателю/статье, НЕЗАВИСИМО от того, была ли оплата.
  - paid (оплачено, факт) — сумма TreasuryPayment.amount по держателю/статье/году, нетто
    с учётом KindOfPayment.is_refund (возвраты вычитаются).
  - remainder — allocated - committed_obligations (может быть отрицательным — перерасход).
"""
from decimal import Decimal

from django.db.models import Sum

from core.choices import PlanItemStatus
from procurement.models import PlanShare, ContractItem, TreasuryPayment, BudgetQuarterlyLimit


def compute_budget_execution_report(year=None, department_id=None, quarter=None):
    shares = PlanShare.objects.filter(status=PlanItemStatus.ACTIVE, budget_cost__status=PlanItemStatus.ACTIVE)
    if year:
        shares = shares.filter(budget_cost__year=year)
    if department_id:
        shares = shares.filter(department_id=department_id)

    if quarter:
        allocated_rows = shares.filter(
            quarterly_limits__status=PlanItemStatus.ACTIVE, quarterly_limits__quarter=quarter,
        ).values(
            'department_id', 'department__short_name',
            'budget_cost__year',
            'budget_cost__internal_economic_class_id', 'budget_cost__internal_economic_class__code',
            'budget_cost__internal_economic_class__name',
        ).annotate(allocated=Sum('quarterly_limits__amount'))
    else:
        allocated_rows = shares.values(
            'department_id', 'department__short_name',
            'budget_cost__year',
            'budget_cost__internal_economic_class_id', 'budget_cost__internal_economic_class__code',
            'budget_cost__internal_economic_class__name',
        ).annotate(allocated=Sum('shared_cost'))

    committed_qs = ContractItem.objects.filter(
        plan_share__status=PlanItemStatus.ACTIVE, plan_share__budget_cost__status=PlanItemStatus.ACTIVE,
    )
    if year:
        committed_qs = committed_qs.filter(plan_share__budget_cost__year=year)
    if department_id:
        committed_qs = committed_qs.filter(plan_share__department_id=department_id)
    committed_qs = committed_qs.values(
        'plan_share__department_id', 'plan_share__budget_cost__year',
        'plan_share__budget_cost__internal_economic_class_id',
    ).annotate(committed=Sum('contract_cost'))
    committed_map = {
        (r['plan_share__department_id'], r['plan_share__budget_cost__year'],
         r['plan_share__budget_cost__internal_economic_class_id']): r['committed']
        for r in committed_qs
    }

    paid_map = _paid_net_map(year=year, department_id=department_id)

    rows = []
    for r in allocated_rows:
        key = (r['department_id'], r['budget_cost__year'], r['budget_cost__internal_economic_class_id'])
        committed = committed_map.get(key) or Decimal('0')
        allocated = r['allocated'] or Decimal('0')
        rows.append({
            'department_id': r['department_id'],
            'department': r['department__short_name'],
            'year': r['budget_cost__year'],
            'quarter': quarter,
            'internal_economic_class_id': r['budget_cost__internal_economic_class_id'],
            'internal_economic_class_code': r['budget_cost__internal_economic_class__code'],
            'internal_economic_class_name': r['budget_cost__internal_economic_class__name'],
            'allocated': allocated,
            'committed_obligations': committed,
            'paid': paid_map.get(key) or Decimal('0'),
            'remainder': allocated - committed,
        })
    return rows


def _paid_net_map(year=None, department_id=None):
    """(department_id, year, internal_economic_class_id) -> оплачено нетто (возвраты вычтены).

    TreasuryPayment не хранит прямую FK на PlanShare/BudgetCosts (это платёжки, не строки
    плана) — сопоставление с держателем и статьёй идёт через `departments` (M2M, см.
    import_reestr26.py) и `internal_economic_class`. Платёж с несколькими бенефициарами
    (свободные платёжки/администр. процедуры) целиком учитывается у КАЖДОГО подразделения —
    осознанное упрощение, таких платежей меньшинство (см. CurrentStatus.md, Проход 12)."""
    qs = TreasuryPayment.objects.filter(departments__isnull=False, internal_economic_class__isnull=False)
    if year:
        qs = qs.filter(payment_year=year)
    if department_id:
        qs = qs.filter(departments__id=department_id)

    net = {}
    for is_refund, sign in ((False, 1), (True, -1)):
        grouped = qs.filter(kind__is_refund=is_refund).values(
            'departments__id', 'payment_year', 'internal_economic_class_id',
        ).annotate(s=Sum('amount'))
        for r in grouped:
            key = (r['departments__id'], r['payment_year'], r['internal_economic_class_id'])
            net[key] = net.get(key, Decimal('0')) + sign * r['s']
    return net
