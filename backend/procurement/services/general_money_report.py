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
  prior_years_obligations   — принятые обязательства прошлых лет: сумма ДВУХ разных (не
                               пересекающихся) сценариев многолетнего финансирования, см.
                               multi_year_reservation.py: (1) `compute_reserved_amount_by_article`
                               — многолетний договор, заключённый до report year, под строкой
                               БЮДЖЕТА ДРУГОГО года (своей строки report year для той позиции
                               ещё не было на момент заключения); (2) добавлено 2026-11-21 по
                               запросу пользователя, `compute_prior_years_budget_costs_by_article`
                               — позиция, опубликованная в ПРЕДЫДУЩЕМ годовом плане, но у
                               которой уже есть собственная строка `BudgetCosts` ИМЕННО report
                               year (многолетнее финансирование разнесено по годам отдельными
                               строками бюджета) — такая позиция никогда не попадёт в план
                               report year (закупка состоялась раньше), поэтому её сумма за
                               report year иначе выпала бы из отчёта незамеченной.
  available_limit           — добавлено 2026-11-21 по запросу пользователя. Доступные лимиты:
                               planned_annual - prior_years_obligations (сколько из годового
                               назначения статьи реально свободно распределять, без учёта уже
                               обязанного многолетними договорами/позициями прошлых планов).
                               Отличается от `unassigned_limit` ниже — та дополнительно
                               вычитает `allocated_limit` (то, что финансист уже довёл по
                               подстатьям), а эта — нет.
  allocated_limit           — доведённые лимиты: сумма ACTIVE записей DepartmentArticleLimit
                               этой статьи/параграфа/года (держатель+подстатья — см.
                               services/department_limits.py) — то, что финансист уже
                               распределил по держателям лимита. До 2026-11-23 считалось по
                               промежуточному уровню "подстатья целиком, department IS NULL" —
                               этот уровень убран (0 записей в проде на момент переделки),
                               теперь источник — сами записи держателей.
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
  is_calibrated             — распределение по держателям проведено хоть раз (решение по
                               запросу фронтенда 2026-11-20, CurrentStatus.md): существует
                               хотя бы одна ACTIVE запись DepartmentArticleLimit этой статьи/
                               параграфа/года — НЕ то же самое, что allocated_limit != 0
                               (легитимный случай: распределили, но вся сумма ушла в ноль по
                               каким-то держателям) — фронту раньше приходилось угадывать это
                               по allocated_limit == 0, что ломалось бы именно на таком
                               легитимном нуле.

Строки сортируются перед возвратом по числовым сегментам `economic_code` (см.
`_economic_code_sort_key()`) — без этого порядок строк из БД не гарантирован (см. комментарий
про отключённый `order_by()` в `compute_general_money_report()`), и фронту приходилось
пересортировывать список на клиенте, чтобы сгруппировать строки по статье для подытогов
(запрос фронтенда 2026-11-20)."""
from decimal import Decimal

from django.db.models import Q, Sum

from core.choices import PlanItemStatus
from procurement.models import (
    ArticleQuarterlyAllocation, BudgetCosts, ContractItem, DepartmentArticleLimit, TreasuryPayment,
)
from procurement.services.multi_year_reservation import (
    compute_prior_years_budget_costs_by_article, compute_reserved_amount_by_article,
)


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

    rows = [_compute_row(a['functional_class_id'], a['economic_class_id'], year) for a in articles]
    rows.sort(key=lambda r: _economic_code_sort_key(r['economic_code']))
    return rows


def _economic_code_sort_key(code):
    """Сортировка по сегментам кода как по числам, не по строке целиком (`"1 10"` должен
    идти раньше `"1 2"`, хотя лексикографически строка `"1 10"` меньше `"1 2"` по случайности
    совпадения первого символа второго сегмента — см. docstring модуля). Каждый числовой
    сегмент дополняется нулями слева до фиксированной ширины, чтобы сравнение оставалось
    обычным строковым (без смешения `int`/`str` в одном ключе сортировки, которое упало бы
    с `TypeError` на нечисловых сегментах, если они когда-нибудь появятся)."""
    if not code:
        return ''
    return ' '.join(part.zfill(6) if part.isdigit() else part for part in str(code).split())


def _compute_row(functional_class_id, economic_class_id, year):
    allocation_qs = ArticleQuarterlyAllocation.objects.filter(
        functional_class_id=functional_class_id, economic_class_id=economic_class_id,
        year=year, status=PlanItemStatus.ACTIVE,
    )
    sample = allocation_qs.select_related('functional_class', 'economic_class').first()
    planned_annual = allocation_qs.aggregate(s=Sum('amount'))['s'] or Decimal('0')

    prior_years_obligations = (
        compute_reserved_amount_by_article(functional_class_id, economic_class_id, year)
        + compute_prior_years_budget_costs_by_article(functional_class_id, economic_class_id, year)
    )

    department_limits = DepartmentArticleLimit.objects.filter(
        functional_class_id=functional_class_id, economic_class_id=economic_class_id,
        year=year, status=PlanItemStatus.ACTIVE,
    )
    allocated_limit = department_limits.aggregate(s=Sum('amount'))['s'] or Decimal('0')
    is_calibrated = department_limits.exists()

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
        # Добавлено 2026-11-21 по запросу пользователя: один и тот же economic_code может
        # встречаться НЕСКОЛЬКИМИ строками отчёта с разными суммами, если финансирование
        # идёт по разным параграфам (functional_class) — без текста параграфа фронт не может
        # показать, "какая 2.40.01.00 к чему относится" (слова пользователя). economic_code/
        # economic_description такой неоднозначности не имеют (unique на ExternalEconomicCode).
        'functional_description': sample.functional_class.description if sample else None,
        'economic_code': sample.economic_class.code_api if sample else None,
        'economic_description': sample.economic_class.description if sample else None,
        'year': year,
        'planned_annual': planned_annual,
        'prior_years_obligations': prior_years_obligations,
        'available_limit': planned_annual - prior_years_obligations,
        'allocated_limit': allocated_limit,
        'is_calibrated': is_calibrated,
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
