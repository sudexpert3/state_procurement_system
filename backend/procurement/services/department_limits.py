# -*- coding: utf-8 -*-
"""
Доступный остаток доведённого держателю лимита по подстатье (решение пользователя
2026-11-03): "в BudgetCosts также находятся лимиты-части подразделений, т.е. одна позиция
может закупаться для разных подразделений-держателей лимитов и суммы будут соответственно
резервироваться в лимитах каждого из подразделений".

Доведённый лимит (DepartmentArticleLimit.amount, department != NULL) уменьшается на то, что
уже привязано к конкретным позициям плана этого держателя под этой же подстатьей —
PlanShare.shared_cost (ACTIVE), где budget_cost.internal_economic_class совпадает с
подстатьёй. Та же идея, что в multi_year_reservation.py (видимый номинал уменьшается на уже
зарезервированное), но здесь резервируем не по будущему году, а по уже распределённым
позициям плана в рамках ТЕКУЩЕГО доведённого лимита держателя.
"""
from decimal import Decimal

from django.db.models import Sum

from core.choices import PlanItemStatus
from procurement.models import PlanShare


def compute_reserved_by_plan_share(internal_economic_class_id, department_id, year):
    """Сумма, уже привязанная к конкретным позициям плана этого держателя под этой подстатьёй
    и годом — PlanShare.shared_cost (ACTIVE), budget_cost тоже ACTIVE."""
    qs = PlanShare.objects.filter(
        status=PlanItemStatus.ACTIVE,
        budget_cost__status=PlanItemStatus.ACTIVE,
        budget_cost__internal_economic_class_id=internal_economic_class_id,
        budget_cost__year=year,
        department_id=department_id,
    )
    return qs.aggregate(s=Sum('shared_cost'))['s'] or Decimal('0')


def compute_available_department_limit(department_limit):
    """Остаток доведённого держателю лимита (DepartmentArticleLimit с department != NULL),
    доступный для НОВЫХ позиций плана — доведённая сумма минус уже зарезервированное через
    PlanShare под этой же подстатьёй/годом/держателем."""
    if not department_limit.department_id:
        raise ValueError("compute_available_department_limit() принимает только лимит ДЕРЖАТЕЛЯ "
                          "(department != NULL) — для подстатьи целиком см. саму запись amount.")
    reserved = compute_reserved_by_plan_share(
        department_limit.internal_economic_class_id, department_limit.department_id, department_limit.year,
    )
    return department_limit.amount - reserved
