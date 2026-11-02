# -*- coding: utf-8 -*-
"""
Общий движок одобрения изменений (Этап 2, решение пользователя 2026-11-02).

Один механизм статусов (ChangeRequest.status: DRAFT -> ON_REVIEW -> APPROVED/REJECTED)
обслуживает несколько видов заявок (ChangeRequest.kind), каждый со своей моделью черновика:
  - PLAN_ITEM_CHANGE — изменение позиции плана: копирует АКТИВНЫЕ PlanItemDetail/
    BudgetCosts(все года)/PlanShare в статус DRAFT. Специалист правит черновик обычными
    PATCH, затем submit -> ON_REVIEW -> approve/reject.
  - PLAN_ITEM_EXCLUSION — исключение позиции: без черновика полей (решение пользователя),
    создаётся сразу в ON_REVIEW с обязательным `reason`.
  - LIMIT_REDISTRIBUTION — перераспределение лимита между держателями/статьями/кварталами
    (Этап 3.3): черновик — строки `BudgetQuarterlyLimit` (разбивка ПО КОНКРЕТНОЙ позиции
    плана/держателю), сумма изменений обязана быть нулевой.
  - BUDGET_LIMIT_CORRECTION — приём корректировок от Казначейства (Этап 3.4, разбор
    fin_2026.xlsb): черновик — строки `ArticleQuarterlyAllocation` (АГРЕГАТ по статье ЭКР
    целиком, без привязки к позиции плана — см. docstring модели, почему это ДРУГАЯ модель,
    не BudgetQuarterlyLimit). Денежная сумма НЕ обязана быть нулевой — Казначейство может
    реально добавить/урезать финансирование, не просто переносить между статьями.
"""
import copy
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from core.choices import ChangeRequestKind, ChangeRequestStatus, PlanItemStatus
from procurement.models import (
    ChangeRequest, PlanShare, BudgetCosts, ContractItem, BudgetQuarterlyLimit,
    ArticleQuarterlyAllocation,
)


def _clone(instance, **overrides):
    """Полная копия строки модели (новый pk) с точечными переопределениями полей.
    Не копирует M2M — их переносит вызывающий код отдельно, после save()."""
    new = copy.copy(instance)
    new.pk = None
    new.id = None
    new._state.adding = True
    for field, value in overrides.items():
        setattr(new, field, value)
    new.save()
    return new


def _ensure_no_open_request(plan_item):
    """Решение пользователя 2026-11-02: не больше одной открытой (DRAFT/ON_REVIEW) заявки
    на одну позицию плана одновременно — защита от конфликтующих параллельных правок."""
    if ChangeRequest.objects.filter(
        plan_item=plan_item,
        status__in=[ChangeRequestStatus.DRAFT, ChangeRequestStatus.ON_REVIEW],
    ).exists():
        raise ValidationError('У этой позиции плана уже есть открытая заявка на изменение.')


def create_change_request(plan_item, kind, reason=''):
    if kind == ChangeRequestKind.BUDGET_LIMIT_CORRECTION:
        raise ValidationError('Для корректировки лимита от Казначейства используйте create_budget_limit_correction().')
    if kind == ChangeRequestKind.LIMIT_REDISTRIBUTION:
        raise ValidationError('Для перераспределения лимита используйте create_redistribution().')

    _ensure_no_open_request(plan_item)

    if kind == ChangeRequestKind.PLAN_ITEM_EXCLUSION and not reason.strip():
        raise ValidationError('Для заявки на исключение позиции обязательно обоснование (reason).')

    with transaction.atomic():
        if kind == ChangeRequestKind.PLAN_ITEM_EXCLUSION:
            # Без черновика полей — заявка сразу уходит на проверку финансиста.
            return ChangeRequest.objects.create(
                plan_item=plan_item, kind=kind, reason=reason,
                status=ChangeRequestStatus.ON_REVIEW, submitted_at=timezone.now(),
            )

        change_request = ChangeRequest.objects.create(
            plan_item=plan_item, kind=kind, reason=reason, status=ChangeRequestStatus.DRAFT,
        )
        _clone_plan_item_change_draft(plan_item, change_request)
        return change_request


def _clone_plan_item_change_draft(plan_item, change_request):
    detail = plan_item.details.filter(status=PlanItemStatus.ACTIVE).first()
    if not detail:
        raise ValidationError('У позиции нет активной детальной информации — нечего менять.')

    new_detail = _clone(detail, status=PlanItemStatus.DRAFT, change_request=change_request)
    new_detail.beneficiary_departments.set(detail.beneficiary_departments.all())

    for bc in plan_item.budget_costs.filter(status=PlanItemStatus.ACTIVE):
        new_bc = _clone(bc, status=PlanItemStatus.DRAFT, change_request=change_request)
        for ps in bc.plan_shares.filter(status=PlanItemStatus.ACTIVE):
            _clone(ps, status=PlanItemStatus.DRAFT, budget_cost=new_bc, change_request=change_request)


def create_redistribution(lines, reason=''):
    """Перераспределение лимита между держателями/статьями/кварталами (Этап 3.3, решение
    пользователя 2026-11-02: через тот же движок ChangeRequest, kind=LIMIT_REDISTRIBUTION).

    `lines` — список словарей {'budget_cost': id, 'plan_share': id|None, 'quarter': 'Q1',
    'amount': Decimal} — НОВАЯ предлагаемая сумма для каждой строки (не дельта). `plan_share`
    не задан — строка про лимит статьи целиком, не распределённый по держателям.

    Перераспределение не создаёт и не уничтожает деньги — сумма (новое - старое) по всем
    строкам должна быть равна нулю. Для добавления денег извне (от Казначейства) — это
    BUDGET_LIMIT_CORRECTION (Этап 3.4), не эта функция."""
    if len(lines) < 2:
        raise ValidationError('Перераспределение требует минимум 2 строки (откуда и куда).')

    with transaction.atomic():
        change_request = ChangeRequest.objects.create(
            plan_item=None, kind=ChangeRequestKind.LIMIT_REDISTRIBUTION, reason=reason,
            status=ChangeRequestStatus.DRAFT,
        )
        total_delta = Decimal('0')
        for line in lines:
            budget_cost = BudgetCosts.objects.get(pk=line['budget_cost'])
            plan_share = PlanShare.objects.get(pk=line['plan_share']) if line.get('plan_share') else None
            quarter = line['quarter']
            new_amount = Decimal(str(line['amount']))

            old = BudgetQuarterlyLimit.objects.filter(
                budget_cost=budget_cost, plan_share=plan_share, quarter=quarter,
                status=PlanItemStatus.ACTIVE,
            ).first()
            total_delta += new_amount - (old.amount if old else Decimal('0'))

            BudgetQuarterlyLimit.objects.create(
                budget_cost=budget_cost, plan_share=plan_share, quarter=quarter,
                amount=new_amount, status=PlanItemStatus.DRAFT, change_request=change_request,
            )

        if total_delta != Decimal('0'):
            # Откатываем транзакцию целиком, не только удаляем ChangeRequest — иначе созданные
            # DRAFT-строки BudgetQuarterlyLimit остались бы висеть без смысла.
            raise ValidationError(
                f'Перераспределение должно быть нулевым по сумме (нельзя создавать/терять '
                f'деньги). Текущая разница: {total_delta} BYN.'
            )

    return change_request


def create_budget_limit_correction(lines, reason=''):
    """Приём корректировок лимитов от Казначейства (Этап 3.4, kind=BUDGET_LIMIT_CORRECTION).
    Вызывается из `services/fin_file_parser.py` после разбора fin_2026.xlsb — но принимает
    уже готовые строки, не читает файл сама (разбор файла — отдельная забота).

    `lines` — список словарей {'functional_class': id, 'economic_class': id, 'year': int,
    'quarter': 'Q1', 'amount': Decimal} — НОВАЯ сумма агрегата по статье на квартал. В отличие
    от create_redistribution() — сумма НЕ обязана быть нулевой (Казначейство реально меняет
    объём финансирования, а не просто переносит между статьями)."""
    if not lines:
        raise ValidationError('Нет строк для создания корректировки лимита.')

    with transaction.atomic():
        change_request = ChangeRequest.objects.create(
            plan_item=None, kind=ChangeRequestKind.BUDGET_LIMIT_CORRECTION, reason=reason,
            status=ChangeRequestStatus.DRAFT,
        )
        for line in lines:
            ArticleQuarterlyAllocation.objects.create(
                functional_class_id=line['functional_class'], economic_class_id=line['economic_class'],
                year=line['year'], quarter=line['quarter'], amount=Decimal(str(line['amount'])),
                status=PlanItemStatus.DRAFT, change_request=change_request,
            )

    return change_request


def submit(change_request):
    """DRAFT -> ON_REVIEW. Для EXCLUSION заявка создаётся уже в ON_REVIEW — submit() для неё
    не вызывается (нет промежуточного черновика, который можно было бы ещё раз отправить)."""
    if change_request.status != ChangeRequestStatus.DRAFT:
        raise ValidationError('Отправить на проверку можно только заявку в статусе "Черновик".')

    with transaction.atomic():
        if change_request.kind == ChangeRequestKind.PLAN_ITEM_CHANGE:
            change_request.draft_details.update(status=PlanItemStatus.DRAFT_ON_REVIEW)
            change_request.draft_budget_costs.update(status=PlanItemStatus.DRAFT_ON_REVIEW)
            change_request.draft_plan_shares.update(status=PlanItemStatus.DRAFT_ON_REVIEW)
        elif change_request.kind == ChangeRequestKind.LIMIT_REDISTRIBUTION:
            change_request.draft_quarterly_limits.update(status=PlanItemStatus.DRAFT_ON_REVIEW)
        elif change_request.kind == ChangeRequestKind.BUDGET_LIMIT_CORRECTION:
            change_request.draft_article_allocations.update(status=PlanItemStatus.DRAFT_ON_REVIEW)

        change_request.status = ChangeRequestStatus.ON_REVIEW
        change_request.submitted_at = timezone.now()
        change_request.save(update_fields=['status', 'submitted_at', 'changed_at'])

    return change_request


def reject(change_request, rejection_reason):
    if change_request.status != ChangeRequestStatus.ON_REVIEW:
        raise ValidationError('Отклонить можно только заявку, отправленную на проверку.')
    if not rejection_reason.strip():
        raise ValidationError('Причина отклонения обязательна.')

    with transaction.atomic():
        if change_request.kind == ChangeRequestKind.PLAN_ITEM_CHANGE:
            # Не удаляем — отклонённый черновик остаётся как есть, это часть истории.
            change_request.draft_details.update(status=PlanItemStatus.DRAFT_REJECTED)
            change_request.draft_budget_costs.update(status=PlanItemStatus.DRAFT_REJECTED)
            change_request.draft_plan_shares.update(status=PlanItemStatus.DRAFT_REJECTED)
        elif change_request.kind == ChangeRequestKind.LIMIT_REDISTRIBUTION:
            change_request.draft_quarterly_limits.update(status=PlanItemStatus.DRAFT_REJECTED)
        elif change_request.kind == ChangeRequestKind.BUDGET_LIMIT_CORRECTION:
            change_request.draft_article_allocations.update(status=PlanItemStatus.DRAFT_REJECTED)

        change_request.status = ChangeRequestStatus.REJECTED
        change_request.rejection_reason = rejection_reason
        change_request.reviewed_at = timezone.now()
        change_request.save(update_fields=['status', 'rejection_reason', 'reviewed_at', 'changed_at'])

    return change_request


def approve(change_request):
    if change_request.status != ChangeRequestStatus.ON_REVIEW:
        raise ValidationError('Одобрить можно только заявку, отправленную на проверку.')

    with transaction.atomic():
        if change_request.kind == ChangeRequestKind.PLAN_ITEM_EXCLUSION:
            _approve_exclusion(change_request)
        elif change_request.kind == ChangeRequestKind.LIMIT_REDISTRIBUTION:
            _approve_quarterly_limits(change_request)
        elif change_request.kind == ChangeRequestKind.BUDGET_LIMIT_CORRECTION:
            _approve_article_allocations(change_request)
        else:
            _approve_plan_item_change(change_request)

        change_request.status = ChangeRequestStatus.APPROVED
        change_request.reviewed_at = timezone.now()
        change_request.save(update_fields=['status', 'reviewed_at', 'changed_at'])

    return change_request


def _approve_exclusion(change_request):
    plan_item = change_request.plan_item
    plan_item.is_active = False
    plan_item.save(update_fields=['is_active', 'updated_at'])
    plan_item.details.filter(status=PlanItemStatus.ACTIVE).update(status=PlanItemStatus.ARCHIVE)
    BudgetCosts.objects.filter(plan_item=plan_item, status=PlanItemStatus.ACTIVE).update(status=PlanItemStatus.ARCHIVE)
    PlanShare.objects.filter(
        budget_cost__plan_item=plan_item, status=PlanItemStatus.ACTIVE,
    ).update(status=PlanItemStatus.ARCHIVE)


def _approve_plan_item_change(change_request):
    plan_item = change_request.plan_item

    old_details = list(plan_item.details.filter(status=PlanItemStatus.ACTIVE))
    old_budget_costs = list(plan_item.budget_costs.filter(status=PlanItemStatus.ACTIVE))
    old_plan_shares = list(PlanShare.objects.filter(budget_cost__in=old_budget_costs, status=PlanItemStatus.ACTIVE))

    # --- архивируем старое ---
    for d in old_details:
        d.status = PlanItemStatus.ARCHIVE
        d.save(update_fields=['status', 'changed_at'])
    for bc in old_budget_costs:
        bc.status = PlanItemStatus.ARCHIVE
        bc.save(update_fields=['status', 'changed_at'])
    for ps in old_plan_shares:
        ps.status = PlanItemStatus.ARCHIVE
        ps.save(update_fields=['status'])

    # --- активируем черновик (по одной записи через save(), не bulk update — чтобы
    # бизнес-валидация PlanShare.save() реально проверила финальное состояние теперь,
    # когда старые ACTIVE-строки уже архивированы, см. комментарий в planShare.py) ---
    new_detail = change_request.draft_details.get()
    new_detail.status = PlanItemStatus.ACTIVE
    new_detail.save()

    new_budget_costs = list(change_request.draft_budget_costs.all())
    for bc in new_budget_costs:
        bc.status = PlanItemStatus.ACTIVE
        bc.save()

    new_plan_shares = list(change_request.draft_plan_shares.all())
    for ps in new_plan_shares:
        ps.status = PlanItemStatus.ACTIVE
        ps.save()

    # --- перепривязываем существующие договоры со старых PlanShare на новые ---
    # Иначе уже заключённые ContractItem останутся висеть на архивной строке, и отчётность
    # "обязательства по подразделению" (Этап 4.4) не найдёт их через новую ACTIVE-строку.
    # Совпадение — по подразделению + логической идентичности строки бюджета
    # (год + budget_code + economic_code, тот же ключ, что в Проходе 10 для BudgetCosts).
    for old_ps in old_plan_shares:
        match = next((
            new_ps for new_ps in new_plan_shares
            if new_ps.department_id == old_ps.department_id
            and new_ps.budget_cost.year == old_ps.budget_cost.year
            and new_ps.budget_cost.budget_code == old_ps.budget_cost.budget_code
            and new_ps.budget_cost.economic_code == old_ps.budget_cost.economic_code
        ), None)
        if match:
            ContractItem.objects.filter(plan_share=old_ps).update(plan_share=match)


def _approve_quarterly_limits(change_request):
    drafts = list(change_request.draft_quarterly_limits.all())

    # Сначала архивируем ВСЕ старые (для каждой строки — по тому же (budget_cost, plan_share,
    # quarter)), потом активируем черновики — порядок важен для валидации BudgetQuarterlyLimit
    # .clean() (сумма долей держателей vs лимит статьи), как и в _approve_plan_item_change().
    for draft in drafts:
        old = BudgetQuarterlyLimit.objects.filter(
            budget_cost=draft.budget_cost, plan_share=draft.plan_share, quarter=draft.quarter,
            status=PlanItemStatus.ACTIVE,
        ).first()
        if old:
            old.status = PlanItemStatus.ARCHIVE
            old.save(update_fields=['status', 'changed_at'])

    for draft in drafts:
        draft.status = PlanItemStatus.ACTIVE
        draft.save()


def _approve_article_allocations(change_request):
    """Одобрение — ПОЛНАЯ замена действующего снимка за затронутые года, а не точечное
    совпадение по (статья, квартал). Каждая заявка этого вида строится парсером из ВСЕГО
    листа "T" по организации на момент разбора (см. services/fin_file_parser.py) — то есть
    представляет собой полную актуальную картину, а не частичную правку. Поэтому любая
    ДЕЙСТВУЮЩАЯ запись за тот же год, которую текущий черновик не подтверждает (её там
    просто нет — статья/параграф не оказались в этом разборе файла), считается устаревшей
    и архивируется вместе с теми, что совпали по ключу.

    Найдено и исправлено 2026-11-02: точечное совпадение по ключу оставляло "осиротевшие"
    ACTIVE-записи от ПРЕДЫДУЩЕЙ (менее точной) заявки активными одновременно с новыми —
    напр. параграф §851 (чужая организация) и ещё 8 статей под §042/§751, которых у УНК 1534
    по факту нет, остались ACTIVE после одобрения исправленной заявки. См. CurrentStatus.md."""
    drafts = list(change_request.draft_article_allocations.all())
    if not drafts:
        return

    years = {d.year for d in drafts}
    draft_pks = [d.pk for d in drafts]

    stale = ArticleQuarterlyAllocation.objects.filter(
        year__in=years, status=PlanItemStatus.ACTIVE,
    ).exclude(pk__in=draft_pks)
    for old in stale:
        old.status = PlanItemStatus.ARCHIVE
        old.save(update_fields=['status', 'changed_at'])

    for draft in drafts:
        draft.status = PlanItemStatus.ACTIVE
        draft.save()


def compute_forecast(change_request):
    """«Прогноз последствий» (2.3) — read-only, ничего не сохраняет.

    Для PLAN_ITEM_CHANGE: по каждой строке черновика BudgetCosts/PlanShare находит текущую
    ДЕЙСТВУЮЩУЮ строку с той же логической идентичностью и сравнивает новую сумму с уже
    принятыми обязательствами (сумма ContractItem.contract_cost) по ней.
    Для PLAN_ITEM_EXCLUSION: нет "нового" значения для сравнения — показывает, что именно
    уже принято/оплачено под позицией и осталось бы "осиротевшим" при исключении.
    Для LIMIT_REDISTRIBUTION/BUDGET_LIMIT_CORRECTION: старое/новое значение и дельта по
    каждой затронутой строке.
    """
    if change_request.kind == ChangeRequestKind.PLAN_ITEM_EXCLUSION:
        return _forecast_exclusion(change_request)
    if change_request.kind == ChangeRequestKind.LIMIT_REDISTRIBUTION:
        return _forecast_redistribution(change_request)
    if change_request.kind == ChangeRequestKind.BUDGET_LIMIT_CORRECTION:
        return _forecast_article_allocations(change_request)
    return _forecast_plan_item_change(change_request)


def _forecast_redistribution(change_request):
    lines = []
    for draft in change_request.draft_quarterly_limits.select_related('budget_cost', 'plan_share__department'):
        old = BudgetQuarterlyLimit.objects.filter(
            budget_cost=draft.budget_cost, plan_share=draft.plan_share, quarter=draft.quarter,
            status=PlanItemStatus.ACTIVE,
        ).first()
        old_amount = old.amount if old else Decimal('0')
        lines.append({
            'budget_cost_id': draft.budget_cost_id,
            'economic_code': draft.budget_cost.economic_code,
            'department': draft.plan_share.department.short_name if draft.plan_share_id else None,
            'quarter': draft.quarter,
            'old_amount': old_amount,
            'new_amount': draft.amount,
            'delta': draft.amount - old_amount,
        })
    return {'lines': lines, 'net_delta': sum((l['delta'] for l in lines), Decimal('0'))}


def _forecast_article_allocations(change_request):
    lines = []
    for draft in change_request.draft_article_allocations.select_related('functional_class', 'economic_class'):
        old = ArticleQuarterlyAllocation.objects.filter(
            functional_class=draft.functional_class, economic_class=draft.economic_class,
            year=draft.year, quarter=draft.quarter, status=PlanItemStatus.ACTIVE,
        ).first()
        old_amount = old.amount if old else Decimal('0')
        lines.append({
            'functional_code': draft.functional_class.code_api,
            'economic_code': draft.economic_class.code_api,
            'year': draft.year,
            'quarter': draft.quarter,
            'old_amount': old_amount,
            'new_amount': draft.amount,
            'delta': draft.amount - old_amount,
        })
    return {'lines': lines, 'net_delta': sum((l['delta'] for l in lines), Decimal('0'))}


def _forecast_plan_item_change(change_request):
    by_article = []
    for draft_bc in change_request.draft_budget_costs.all():
        active_bc = BudgetCosts.objects.filter(
            plan_item=change_request.plan_item, status=PlanItemStatus.ACTIVE,
            year=draft_bc.year, budget_code=draft_bc.budget_code, economic_code=draft_bc.economic_code,
        ).first()
        committed = Decimal('0')
        if active_bc:
            committed = ContractItem.objects.filter(
                plan_share__budget_cost=active_bc,
            ).aggregate(s=Sum('contract_cost'))['s'] or Decimal('0')
        shortfall = committed - draft_bc.cost
        by_article.append({
            'year': draft_bc.year,
            'economic_code': draft_bc.economic_code,
            'new_allocated': draft_bc.cost,
            'committed_obligations': committed,
            'is_over_budget': shortfall > 0,
            'shortfall': max(shortfall, Decimal('0')),
        })

    by_department = []
    for draft_ps in change_request.draft_plan_shares.all():
        active_ps = PlanShare.objects.filter(
            department=draft_ps.department, status=PlanItemStatus.ACTIVE,
            budget_cost__plan_item=change_request.plan_item,
            budget_cost__year=draft_ps.budget_cost.year,
            budget_cost__budget_code=draft_ps.budget_cost.budget_code,
            budget_cost__economic_code=draft_ps.budget_cost.economic_code,
        ).first()
        committed = Decimal('0')
        if active_ps:
            committed = ContractItem.objects.filter(plan_share=active_ps).aggregate(
                s=Sum('contract_cost'))['s'] or Decimal('0')
        shortfall = committed - draft_ps.shared_cost
        by_department.append({
            'department': draft_ps.department.short_name,
            'year': draft_ps.budget_cost.year,
            'new_allocated': draft_ps.shared_cost,
            'committed_obligations': committed,
            'is_over_budget': shortfall > 0,
            'shortfall': max(shortfall, Decimal('0')),
        })

    return {'by_article': by_article, 'by_department': by_department}


def _forecast_exclusion(change_request):
    plan_item = change_request.plan_item
    active_budgets = BudgetCosts.objects.filter(plan_item=plan_item, status=PlanItemStatus.ACTIVE)
    active_shares = PlanShare.objects.filter(budget_cost__in=active_budgets, status=PlanItemStatus.ACTIVE)

    by_department = []
    for ps in active_shares.select_related('department', 'budget_cost'):
        committed = ContractItem.objects.filter(plan_share=ps).aggregate(
            s=Sum('contract_cost'))['s'] or Decimal('0')
        by_department.append({
            'department': ps.department.short_name,
            'year': ps.budget_cost.year,
            'allocated': ps.shared_cost,
            'committed_obligations': committed,
        })

    return {'by_department': by_department}
