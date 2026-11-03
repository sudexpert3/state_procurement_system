# -*- coding: utf-8 -*-
"""
Многолетнее резервирование лимитов (Этап 3.1-3.2, ТЗ п.5, пример "ДНК 2026/2027" —
многолетний договор, заключённый в текущем году, часть обязательств которого приходится на
будущий год, план которого ещё не сформирован/не распределён по подразделениям).

Механизм опирается на уже существующее поле `ContractItem.year` (models/contract.py) —
оно НЕЗАВИСИМО от года бюджетной строки, к которой привязан `ContractItem` через
`plan_share.budget_cost.year`. Договор заводится под уже существующей (как правило —
текущего года) строкой `BudgetCosts`/`PlanShare` этой позиции плана, но часть его строк
(`ContractItem`) помечается `year=<будущий год>` — это и есть "резерв наперёд": деньги на
будущий год уже обязаны быть выделены этим договором, хотя собственной бюджетной строки
того года для этой позиции в БД может ещё не быть.

Когда план будущего года реально формируется и для позиции появляется своя
`BudgetCosts(year=<будущий год>)`, расчёт остатка, доступного для распределения
(`compute_available_for_distribution`), автоматически уменьшает номинал на уже
зарезервированную сумму — специалист видит не полную сумму статьи, а то, что
действительно свободно для новых договоров/подразделений.

Повторный счёт исключён условием `exclude(plan_share__budget_cost__year=year)`: если
специалист впоследствии заводит НОВЫЙ `ContractItem` непосредственно под строкой нужного
года (а не наперёд, под строкой прошлого года), он для расчёта резерва не считается —
это уже обычная текущая история договора того года, а не резерв. Старый "резервирующий"
`ContractItem` при этом не трогаем и никуда не переносим — явная миграция не нужна, т.к.
он продолжает быть реальной историей (договор действительно был заключён именно так).
"""
from decimal import Decimal

from django.db.models import Sum

from core.choices import PlanItemStatus
from procurement.models import ContractItem


def compute_reserved_amount(plan_item, year, department_id=None):
    """Сумма, зарезервированная НА `year` уже заключёнными договорами этой позиции плана
    через бюджетную строку ДРУГОГО года (т.е. `ContractItem.year == year`, но его
    `plan_share.budget_cost.year != year` — договор был заключён до появления собственной
    строки бюджета нужного года для этой позиции)."""
    qs = ContractItem.objects.filter(
        plan_share__budget_cost__plan_item=plan_item, year=year,
    ).exclude(plan_share__budget_cost__year=year)
    if department_id:
        qs = qs.filter(plan_share__department_id=department_id)
    return qs.aggregate(s=Sum('contract_cost'))['s'] or Decimal('0')


def compute_reserved_amount_by_article(functional_class_id, economic_class_id, year):
    """Та же логика, что compute_reserved_amount(), но агрегированная по ВСЕЙ статье
    (functional_class+economic_class) сразу, а не по одной позиции плана — нужна для отчёта
    "Общие деньги" и калибровки доведённых лимитов (DEPARTMENT_LIMIT_CALIBRATION, Этап,
    решение пользователя 2026-11-03)."""
    qs = ContractItem.objects.filter(
        year=year,
        plan_share__status=PlanItemStatus.ACTIVE,
        plan_share__budget_cost__status=PlanItemStatus.ACTIVE,
        plan_share__budget_cost__functional_class_id=functional_class_id,
        plan_share__budget_cost__economic_class_id=economic_class_id,
    ).exclude(plan_share__budget_cost__year=year)
    return qs.aggregate(s=Sum('contract_cost'))['s'] or Decimal('0')


def compute_available_for_distribution(budget_cost):
    """Остаток, реально доступный для распределения по подразделениям в рамках этой
    бюджетной строки — номинальная сумма статьи (`budget_cost.cost`) за вычетом уже
    зарезервированного на этот год многолетними договорами, заключёнными ДО появления
    этой строки (см. docstring модуля)."""
    reserved = compute_reserved_amount(budget_cost.plan_item, budget_cost.year)
    return budget_cost.cost - reserved
