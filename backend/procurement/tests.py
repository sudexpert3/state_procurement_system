from decimal import Decimal
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.exceptions import ValidationError as DRFValidationError

from core.choices import (
    ChangeRequestKind, ChangeRequestStatus, PlanItemStatus, ProcurementItemTypes, QuarterTypes,
    UserRoleType,
)
from procurement.models import (
    PlanItem, PlanItemDetail, BudgetCosts, PlanShare, Department, Contract, ContractItem,
    Supplier, Purchases, ChangeRequest, BudgetQuarterlyLimit, InternalEconomicClassifier,
    TreasuryPayment, KindOfPayment, ContractQuarterlyFinance, Buyer,
)
from procurement.serializers.planShare import PlanShareSerializer
from procurement.serializers.planItemDetail import PlanItemDetailSerializer
from procurement.serializers.treasuryPayment import TreasuryPaymentSerializer
from procurement.serializers.contractQuarterlyFinance import ContractQuarterlyFinanceSerializer
from procurement.serializers.budgetCosts import BudgetCostsImportSerializer, BudgetCostsSerializer
from procurement.services.code_normalization import (
    normalize_functional_code, normalize_economic_code, normalize_program_code,
)
from procurement.services import change_requests as cr_service
from procurement.services.budget_execution_report import compute_budget_execution_report
from procurement.services.multi_year_reservation import compute_reserved_amount, compute_available_for_distribution
from procurement.services import goszakupki_push
from procurement.services import department_limits as department_limits_service
from procurement.services.general_money_report import compute_general_money_report


class ChangeRequestEngineTestCase(TestCase):
    """Общий движок одобрения изменений (Этап 2) — изменение и исключение позиции плана."""

    def setUp(self):
        self.purchases = Purchases.objects.create(year=2026)
        self.department = Department.objects.create(full_name='Тестовое управление', short_name='ТУ')
        self.plan_item = PlanItem.objects.create(plan_purchase=self.purchases, num='2026-TEST-1', is_public=True)
        self.detail = PlanItemDetail.objects.create(
            plan_item=self.plan_item, status=PlanItemStatus.ACTIVE, num='2026-TEST-1',
            title='Тестовая позиция', okrb='00.00.00.000', val_amount=Decimal('1'),
        )
        self.budget_cost = BudgetCosts.objects.create(
            plan_item=self.plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=1,
            cost=Decimal('1000.00'), year=2026, economic_code='1 10 10 99',
        )
        self.plan_share = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=self.budget_cost, department=self.department,
            shared_amount=Decimal('1'), shared_cost=Decimal('1000.00'),
        )
        self.supplier = Supplier.objects.create(name='Тестовый поставщик')
        self.contract = Contract.objects.create(
            number='T-1', supplier=self.supplier, total_cost=Decimal('600.00'),
            planned_delivery_date='2026-12-31',
        )
        self.contract_item = ContractItem.objects.create(
            contract=self.contract, plan_share=self.plan_share,
            contract_amount=Decimal('1'), contract_cost=Decimal('600.00'),
        )

    def test_plan_item_change_full_cycle_approve(self):
        cr = cr_service.create_change_request(self.plan_item, ChangeRequestKind.PLAN_ITEM_CHANGE)
        self.assertEqual(cr.status, ChangeRequestStatus.DRAFT)

        draft_detail = cr.draft_details.get()
        self.assertEqual(draft_detail.status, PlanItemStatus.DRAFT)
        self.assertEqual(draft_detail.title, 'Тестовая позиция')

        draft_bc = cr.draft_budget_costs.get()
        draft_bc.cost = Decimal('500.00')  # специалист уменьшает лимит ниже уже принятых 600
        draft_bc.save()
        draft_ps = cr.draft_plan_shares.get()
        draft_ps.shared_cost = Decimal('500.00')
        draft_ps.save()

        forecast = cr_service.compute_forecast(cr)
        self.assertTrue(forecast['by_article'][0]['is_over_budget'])
        self.assertEqual(forecast['by_article'][0]['shortfall'], Decimal('100.00'))
        self.assertTrue(forecast['by_department'][0]['is_over_budget'])

        cr_service.submit(cr)
        cr.refresh_from_db()
        self.assertEqual(cr.status, ChangeRequestStatus.ON_REVIEW)
        draft_bc.refresh_from_db()
        self.assertEqual(draft_bc.status, PlanItemStatus.DRAFT_ON_REVIEW)

        cr_service.approve(cr)
        cr.refresh_from_db()
        self.assertEqual(cr.status, ChangeRequestStatus.APPROVED)

        self.budget_cost.refresh_from_db()
        self.assertEqual(self.budget_cost.status, PlanItemStatus.ARCHIVE)
        draft_bc.refresh_from_db()
        self.assertEqual(draft_bc.status, PlanItemStatus.ACTIVE)
        self.assertEqual(draft_bc.cost, Decimal('500.00'))

        # договор должен быть перепривязан на новый (ACTIVE) PlanShare
        self.contract_item.refresh_from_db()
        self.assertEqual(self.contract_item.plan_share_id, draft_ps.pk)

        # у позиции плана ровно один ACTIVE снимок каждого типа
        self.assertEqual(self.plan_item.details.filter(status=PlanItemStatus.ACTIVE).count(), 1)
        self.assertEqual(self.plan_item.budget_costs.filter(status=PlanItemStatus.ACTIVE).count(), 1)

    def test_plan_item_change_reject_keeps_old_active(self):
        cr = cr_service.create_change_request(self.plan_item, ChangeRequestKind.PLAN_ITEM_CHANGE)
        cr_service.submit(cr)
        cr_service.reject(cr, 'Недостаточно обоснования')
        cr.refresh_from_db()

        self.assertEqual(cr.status, ChangeRequestStatus.REJECTED)
        self.assertEqual(cr.rejection_reason, 'Недостаточно обоснования')
        self.budget_cost.refresh_from_db()
        self.assertEqual(self.budget_cost.status, PlanItemStatus.ACTIVE)  # старое не тронуто
        self.assertEqual(cr.draft_budget_costs.get().status, PlanItemStatus.DRAFT_REJECTED)

    def test_only_one_open_request_per_plan_item(self):
        cr_service.create_change_request(self.plan_item, ChangeRequestKind.PLAN_ITEM_CHANGE)
        with self.assertRaises(ValidationError):
            cr_service.create_change_request(self.plan_item, ChangeRequestKind.PLAN_ITEM_CHANGE)

    def test_exclusion_requires_reason_and_has_no_draft(self):
        with self.assertRaises(ValidationError):
            cr_service.create_change_request(self.plan_item, ChangeRequestKind.PLAN_ITEM_EXCLUSION)

        cr = cr_service.create_change_request(
            self.plan_item, ChangeRequestKind.PLAN_ITEM_EXCLUSION, reason='Закупка не нужна',
        )
        self.assertEqual(cr.status, ChangeRequestStatus.ON_REVIEW)  # сразу на проверке
        self.assertFalse(cr.draft_details.exists())

        forecast = cr_service.compute_forecast(cr)
        self.assertEqual(forecast['by_department'][0]['committed_obligations'], Decimal('600.00'))

        cr_service.approve(cr)
        self.plan_item.refresh_from_db()
        self.assertFalse(self.plan_item.is_active)
        self.budget_cost.refresh_from_db()
        self.assertEqual(self.budget_cost.status, PlanItemStatus.ARCHIVE)

    def test_budget_limit_correction_uses_dedicated_function(self):
        with self.assertRaises(ValidationError):
            cr_service.create_change_request(self.plan_item, ChangeRequestKind.BUDGET_LIMIT_CORRECTION)

    def test_delete_draft_removes_change_request_and_children(self):
        """Решение пользователя (2026-11-20): специалист может удалить черновик заявки,
        который начал готовить и передумал — не дожидаясь отклонения."""
        cr = cr_service.create_change_request(self.plan_item, ChangeRequestKind.PLAN_ITEM_CHANGE)
        cr_id = cr.pk
        draft_bc_id = cr.draft_budget_costs.get().pk

        cr_service.delete_draft(cr)

        self.assertFalse(ChangeRequest.objects.filter(pk=cr_id).exists())
        self.assertFalse(BudgetCosts.objects.filter(pk=draft_bc_id).exists())
        # старая ACTIVE-строка не тронута — удаление черновика не должно её архивировать
        self.budget_cost.refresh_from_db()
        self.assertEqual(self.budget_cost.status, PlanItemStatus.ACTIVE)

    def test_delete_draft_refuses_non_draft_status(self):
        cr = cr_service.create_change_request(self.plan_item, ChangeRequestKind.PLAN_ITEM_CHANGE)
        cr_service.submit(cr)
        with self.assertRaises(ValidationError):
            cr_service.delete_draft(cr)
        self.assertTrue(ChangeRequest.objects.filter(pk=cr.pk).exists())


class ChangeRequestDestroyApiTestCase(TestCase):
    """DELETE /api/change_requests/{id}/ (решение пользователя 2026-11-20) — проверяет именно
    HTTP-слой: ModelViewSet.destroy() переопределён на cr_service.delete_draft() (см.
    views/changeRequest.py), потому что "голый" DELETE уронил бы ProtectedError (все дочерние
    DRAFT-строки ссылаются на ChangeRequest через on_delete=PROTECT)."""

    def setUp(self):
        from rest_framework.test import APIClient
        self.client = APIClient()
        self.purchases = Purchases.objects.create(year=2026)
        self.plan_item = PlanItem.objects.create(plan_purchase=self.purchases, num='2026-TEST-DEL', is_public=True)
        PlanItemDetail.objects.create(
            plan_item=self.plan_item, status=PlanItemStatus.ACTIVE, num='2026-TEST-DEL',
            title='Позиция на удаление черновика', okrb='00.00.00.000', val_amount=Decimal('1'),
        )

    def test_delete_draft_returns_204(self):
        cr = cr_service.create_change_request(self.plan_item, ChangeRequestKind.PLAN_ITEM_CHANGE)
        response = self.client.delete(f'/api/change_requests/{cr.pk}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(ChangeRequest.objects.filter(pk=cr.pk).exists())

    def test_delete_on_review_returns_400_not_500(self):
        cr = cr_service.create_change_request(self.plan_item, ChangeRequestKind.PLAN_ITEM_CHANGE)
        cr_service.submit(cr)
        response = self.client.delete(f'/api/change_requests/{cr.pk}/')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(ChangeRequest.objects.filter(pk=cr.pk).exists())


class BudgetQuarterlyLimitTestCase(TestCase):
    """Квартальное распределение лимита (Этап 3.3)."""

    def setUp(self):
        purchases = Purchases.objects.create(year=2026)
        department = Department.objects.create(full_name='Тестовое управление 2', short_name='ТУ2')
        plan_item = PlanItem.objects.create(plan_purchase=purchases, num='2026-TEST-2', is_public=True)
        self.budget_cost = BudgetCosts.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=2,
            cost=Decimal('1000.00'), year=2026,
        )
        self.plan_share = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=self.budget_cost, department=department,
            shared_amount=Decimal('1'), shared_cost=Decimal('1000.00'),
        )

    def test_article_level_limit_created_without_plan_share(self):
        limit = BudgetQuarterlyLimit.objects.create(
            budget_cost=self.budget_cost, quarter=QuarterTypes.Q1, amount=Decimal('250.00'),
        )
        self.assertIsNone(limit.plan_share_id)

    def test_department_shares_cannot_exceed_article_quarterly_limit(self):
        BudgetQuarterlyLimit.objects.create(
            budget_cost=self.budget_cost, quarter=QuarterTypes.Q1, amount=Decimal('250.00'),
        )
        BudgetQuarterlyLimit.objects.create(
            plan_share=self.plan_share, budget_cost=self.budget_cost, quarter=QuarterTypes.Q1,
            amount=Decimal('250.00'),
        )
        # Второй держатель той же статьи/квартала толкает сумму сверх доведённого лимита (250).
        department2 = Department.objects.create(full_name='Тестовое управление 3', short_name='ТУ3')
        plan_share2 = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=self.budget_cost, department=department2,
            shared_amount=Decimal('0'), shared_cost=Decimal('0'),
        )
        with self.assertRaises(ValidationError):
            BudgetQuarterlyLimit.objects.create(
                plan_share=plan_share2, budget_cost=self.budget_cost, quarter=QuarterTypes.Q1,
                amount=Decimal('1.00'),
            )

    def test_draft_limit_not_validated_until_active(self):
        BudgetQuarterlyLimit.objects.create(
            budget_cost=self.budget_cost, quarter=QuarterTypes.Q1, amount=Decimal('250.00'),
        )
        # Черновик с заведомо избыточной суммой — не валидируется, пока не ACTIVE.
        draft = BudgetQuarterlyLimit.objects.create(
            plan_share=self.plan_share, budget_cost=self.budget_cost, quarter=QuarterTypes.Q1,
            amount=Decimal('999999.00'), status=PlanItemStatus.DRAFT,
        )
        self.assertEqual(draft.status, PlanItemStatus.DRAFT)


class BudgetExecutionReportTestCase(TestCase):
    """Оперативный отчёт «назначено — обязательства — оплачено — остаток» (Этап 4.4)."""

    def setUp(self):
        purchases = Purchases.objects.create(year=2026)
        self.department = Department.objects.create(full_name='Тестовое управление 4', short_name='ТУ4')
        plan_item = PlanItem.objects.create(plan_purchase=purchases, num='2026-TEST-4', is_public=True)
        self.iec = InternalEconomicClassifier.objects.create(code='9999999999', name='Тестовая статья')
        self.budget_cost = BudgetCosts.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=4,
            cost=Decimal('1000.00'), year=2026, internal_economic_class=self.iec,
        )
        self.plan_share = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=self.budget_cost, department=self.department,
            shared_amount=Decimal('1'), shared_cost=Decimal('800.00'),
        )
        supplier = Supplier.objects.create(name='Тестовый поставщик 2')
        contract = Contract.objects.create(
            number='T-2', supplier=supplier, total_cost=Decimal('500.00'), planned_delivery_date='2026-12-31',
        )
        ContractItem.objects.create(
            contract=contract, plan_share=self.plan_share, contract_amount=Decimal('1'),
            contract_cost=Decimal('500.00'),
        )
        kind_normal = KindOfPayment.objects.create(name='Тестовый платёж')
        kind_refund = KindOfPayment.objects.create(name='Тестовый возврат', is_refund=True)
        p1 = TreasuryPayment.objects.create(
            amount=Decimal('300.00'), kind=kind_normal, internal_economic_class=self.iec,
            payment_year=2026, contract=contract, program_class=None,
        )
        p1.departments.set([self.department])
        p2 = TreasuryPayment.objects.create(
            amount=Decimal('50.00'), kind=kind_refund, internal_economic_class=self.iec,
            payment_year=2026, contract=contract, program_class=None,
        )
        p2.departments.set([self.department])

    def test_annual_report_row(self):
        rows = compute_budget_execution_report(year=2026, department_id=self.department.pk)
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row['allocated'], Decimal('800.00'))
        self.assertEqual(row['committed_obligations'], Decimal('500.00'))
        self.assertEqual(row['paid'], Decimal('250.00'))  # 300 - 50 (возврат)
        self.assertEqual(row['remainder'], Decimal('300.00'))  # 800 - 500

    def test_quarterly_allocation_used_when_quarter_given(self):
        BudgetQuarterlyLimit.objects.create(
            plan_share=self.plan_share, budget_cost=self.budget_cost, quarter=QuarterTypes.Q1,
            amount=Decimal('200.00'),
        )
        rows = compute_budget_execution_report(year=2026, department_id=self.department.pk, quarter=QuarterTypes.Q1)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['allocated'], Decimal('200.00'))

    def test_other_quarter_shows_row_with_zero_allocated_not_empty(self):
        """Баг 2026-11-19 (фронтенд): строка по кварталу без доведённого лимита раньше ПРОПАДАЛА
        целиком (INNER JOIN с BudgetQuarterlyLimit), хотя обязательства/оплата по ней есть.
        Теперь строка остаётся, allocated — просто 0."""
        BudgetQuarterlyLimit.objects.create(
            plan_share=self.plan_share, budget_cost=self.budget_cost, quarter=QuarterTypes.Q1,
            amount=Decimal('200.00'),
        )
        rows = compute_budget_execution_report(year=2026, department_id=self.department.pk, quarter=QuarterTypes.Q2)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['allocated'], Decimal('0'))
        self.assertEqual(rows[0]['committed_obligations'], Decimal('500.00'))
        self.assertEqual(rows[0]['paid'], Decimal('250.00'))

    def test_quarter_report_not_empty_when_budget_quarterly_limit_table_is_empty(self):
        """Точный репро бага с CurrentStatus.md: в реальной БД BudgetQuarterlyLimit пуста
        (доведение лимитов по кварталам ещё не ведётся) — отчёт по любому кварталу
        возвращал [] целиком вместо строк с allocated=0."""
        rows = compute_budget_execution_report(year=2026, department_id=self.department.pk, quarter=QuarterTypes.Q1)
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]['allocated'], Decimal('0'))
        self.assertEqual(rows[0]['committed_obligations'], Decimal('500.00'))
        self.assertEqual(rows[0]['paid'], Decimal('250.00'))


class LimitRedistributionTestCase(TestCase):
    """Перераспределение лимита между держателями/статьями/кварталами (Этап 3.3)."""

    def setUp(self):
        purchases = Purchases.objects.create(year=2026)
        self.dept_a = Department.objects.create(full_name='Держатель А', short_name='ДА')
        self.dept_b = Department.objects.create(full_name='Держатель Б', short_name='ДБ')
        plan_item = PlanItem.objects.create(plan_purchase=purchases, num='2026-TEST-5', is_public=True)
        self.budget_cost = BudgetCosts.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=5,
            cost=Decimal('1000.00'), year=2026,
        )
        self.share_a = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=self.budget_cost, department=self.dept_a,
            shared_amount=Decimal('1'), shared_cost=Decimal('600.00'),
        )
        self.share_b = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=self.budget_cost, department=self.dept_b,
            shared_amount=Decimal('1'), shared_cost=Decimal('400.00'),
        )
        self.limit_a = BudgetQuarterlyLimit.objects.create(
            plan_share=self.share_a, budget_cost=self.budget_cost, quarter=QuarterTypes.Q1,
            amount=Decimal('300.00'),
        )
        self.limit_b = BudgetQuarterlyLimit.objects.create(
            plan_share=self.share_b, budget_cost=self.budget_cost, quarter=QuarterTypes.Q1,
            amount=Decimal('200.00'),
        )

    def test_non_zero_sum_rejected(self):
        with self.assertRaises(ValidationError):
            cr_service.create_redistribution([
                {'budget_cost': self.budget_cost.pk, 'plan_share': self.share_a.pk,
                 'quarter': QuarterTypes.Q1, 'amount': Decimal('250.00')},
                {'budget_cost': self.budget_cost.pk, 'plan_share': self.share_b.pk,
                 'quarter': QuarterTypes.Q1, 'amount': Decimal('260.00')},  # +60, не -50
            ])
        # после неудачной попытки не осталось повисших черновиков
        self.assertEqual(ChangeRequest.objects.count(), 0)
        self.assertEqual(BudgetQuarterlyLimit.objects.filter(status=PlanItemStatus.DRAFT).count(), 0)

    def test_full_cycle_moves_money_between_departments(self):
        cr = cr_service.create_redistribution([
            {'budget_cost': self.budget_cost.pk, 'plan_share': self.share_a.pk,
             'quarter': QuarterTypes.Q1, 'amount': Decimal('250.00')},  # -50
            {'budget_cost': self.budget_cost.pk, 'plan_share': self.share_b.pk,
             'quarter': QuarterTypes.Q1, 'amount': Decimal('250.00')},  # +50
        ], reason='Перебросить остаток от А к Б')
        self.assertEqual(cr.kind, ChangeRequestKind.LIMIT_REDISTRIBUTION)
        self.assertIsNone(cr.plan_item)

        forecast = cr_service.compute_forecast(cr)
        self.assertEqual(forecast['net_delta'], Decimal('0'))
        deltas = {l['department']: l['delta'] for l in forecast['lines']}
        self.assertEqual(deltas['ДА'], Decimal('-50.00'))
        self.assertEqual(deltas['ДБ'], Decimal('50.00'))

        cr_service.submit(cr)
        cr_service.approve(cr)
        cr.refresh_from_db()
        self.assertEqual(cr.status, ChangeRequestStatus.APPROVED)

        self.limit_a.refresh_from_db()
        self.assertEqual(self.limit_a.status, PlanItemStatus.ARCHIVE)
        self.limit_b.refresh_from_db()
        self.assertEqual(self.limit_b.status, PlanItemStatus.ARCHIVE)

        new_a = BudgetQuarterlyLimit.objects.get(plan_share=self.share_a, quarter=QuarterTypes.Q1, status=PlanItemStatus.ACTIVE)
        new_b = BudgetQuarterlyLimit.objects.get(plan_share=self.share_b, quarter=QuarterTypes.Q1, status=PlanItemStatus.ACTIVE)
        self.assertEqual(new_a.amount, Decimal('250.00'))
        self.assertEqual(new_b.amount, Decimal('250.00'))

    def test_requires_at_least_two_lines(self):
        with self.assertRaises(ValidationError):
            cr_service.create_redistribution([
                {'budget_cost': self.budget_cost.pk, 'plan_share': self.share_a.pk,
                 'quarter': QuarterTypes.Q1, 'amount': Decimal('300.00')},
            ])


class BudgetLimitCorrectionTestCase(TestCase):
    """Приём корректировок лимитов от Казначейства (Этап 3.4) — агрегатный уровень статьи.

    Решение пользователя (2026-11-20): отдельное согласование (submit/approve) для этого вида
    заявки убрано — create_budget_limit_correction() теперь сама отправляет и одобряет
    заявку в одной транзакции, т.к. доступ к ней и так ограничен ролью (финансист/админ)."""

    def setUp(self):
        from procurement.models import FunctionalCode, ExternalEconomicCode
        self.func = FunctionalCode.objects.create(code_api='03 12 00 039', description='ГКСЭ')
        self.econ = ExternalEconomicCode.objects.create(code_api='1 10 10 99', description='Прочие текущие расходы')

    def test_full_cycle_creates_active_allocation(self):
        from procurement.models import ArticleQuarterlyAllocation
        cr = cr_service.create_budget_limit_correction([
            {'functional_class': self.func.pk, 'economic_class': self.econ.pk,
             'year': 2026, 'quarter': QuarterTypes.Q1, 'amount': Decimal('9831556.00')},
        ], reason='fin_2026.xlsb от 2026-11-02')
        self.assertEqual(cr.kind, ChangeRequestKind.BUDGET_LIMIT_CORRECTION)
        self.assertEqual(cr.status, ChangeRequestStatus.APPROVED)  # применяется сразу, без ON_REVIEW

        active = ArticleQuarterlyAllocation.objects.get(
            functional_class=self.func, economic_class=self.econ, year=2026,
            quarter=QuarterTypes.Q1, status=PlanItemStatus.ACTIVE,
        )
        self.assertEqual(active.amount, Decimal('9831556.00'))

    def test_second_correction_archives_first(self):
        cr1 = cr_service.create_budget_limit_correction([
            {'functional_class': self.func.pk, 'economic_class': self.econ.pk,
             'year': 2026, 'quarter': QuarterTypes.Q1, 'amount': Decimal('100.00')},
        ])
        self.assertEqual(cr1.status, ChangeRequestStatus.APPROVED)

        cr2 = cr_service.create_budget_limit_correction([
            {'functional_class': self.func.pk, 'economic_class': self.econ.pk,
             'year': 2026, 'quarter': QuarterTypes.Q1, 'amount': Decimal('150.00')},
        ])
        self.assertEqual(cr2.status, ChangeRequestStatus.APPROVED)

        from procurement.models import ArticleQuarterlyAllocation
        self.assertEqual(
            ArticleQuarterlyAllocation.objects.filter(status=PlanItemStatus.ACTIVE).count(), 1,
        )
        self.assertEqual(
            ArticleQuarterlyAllocation.objects.get(status=PlanItemStatus.ACTIVE).amount, Decimal('150.00'),
        )
        self.assertEqual(
            ArticleQuarterlyAllocation.objects.filter(status=PlanItemStatus.ARCHIVE).count(), 1,
        )

    def test_empty_lines_rejected(self):
        with self.assertRaises(ValidationError):
            cr_service.create_budget_limit_correction([])


class FinFileParserPreviewTestCase(TestCase):
    """`fin_file_parser.build_preview()` — обёртка REST-предпросмотра (задание фронтенда
    2026-11-19) над parse_fin_file(). Сам разбор .xlsb не мокаем здесь целиком — он уже
    покрыт ручной проверкой на реальном fin_2026.xlsb (см. management-команду); проверяем
    именно то, что добавляет build_preview: расшифровку id в объекты справочников и
    JSON-пригодный вид report (set -> список, tuple -> словарь)."""

    def setUp(self):
        from procurement.models import FunctionalCode, ExternalEconomicCode
        self.func = FunctionalCode.objects.create(code_api='03 12 00 039', description='ГКСЭ')
        self.econ = ExternalEconomicCode.objects.create(code_api='1 10 10 99', description='Прочие текущие расходы')

    @patch('procurement.services.fin_file_parser.parse_fin_file')
    def test_enriches_lines_and_normalizes_report(self, mock_parse):
        from procurement.services import fin_file_parser

        mock_parse.return_value = (
            [{'functional_class': self.func.pk, 'economic_class': self.econ.pk,
              'year': 2026, 'quarter': 'Q1', 'amount': Decimal('100.00')}],
            {
                'rows_total': 3, 'matched_articles': 1,
                'excluded': [('03_12_00_039_99_00', '1.10.01.00')],
                'functional_not_found': {'03_12_00_999_99_00'},
                'economic_not_found': {'9.99.99.99'},
            },
        )

        result = fin_file_parser.build_preview('irrelevant/path.xlsb', 2026, unk=1534)

        mock_parse.assert_called_once_with('irrelevant/path.xlsb', 2026, unk=1534, sheet_name=fin_file_parser.SHEET_NAME)
        line = result['lines'][0]
        self.assertEqual(line['functional_class'], self.func.pk)
        self.assertEqual(line['functional_class_detail'], self.func)
        self.assertEqual(line['economic_class_detail'], self.econ)
        self.assertEqual(line['amount'], Decimal('100.00'))

        report = result['report']
        self.assertEqual(report['excluded'], [{'functional_raw_code': '03_12_00_039_99_00',
                                               'economic_raw_code': '1.10.01.00'}])
        self.assertEqual(report['functional_not_found'], ['03_12_00_999_99_00'])
        self.assertEqual(report['economic_not_found'], ['9.99.99.99'])


class BudgetLimitCorrectionApiTestCase(TestCase):
    """REST-слой для предпросмотра/подтверждения импорта корректировки лимитов (задание
    фронтенда 2026-11-19, CurrentStatus.md). Предпросмотр мокает fin_file_parser.build_preview
    (сам разбор .xlsb уже покрыт отдельно, см. FinFileParserPreviewTestCase) — здесь
    проверяется HTTP-слой: multipart-приём файла, временный файл, коды ответа.

    Решение пользователя (2026-11-20): оба действия доступны только финансисту/админу
    (CAPABILITIES['budget_limit_correction']) — здесь аутентифицируемся финансистом, чтобы
    проверять именно бизнес-логику; саму проверку прав см. в
    AnonymousBudgetLimitCorrectionAccessTestCase ниже."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient
        from procurement.models import FunctionalCode, ExternalEconomicCode
        self.client = APIClient()  # нужен .post(..., format=...) — обычный django.test.Client его не поддерживает
        user = get_user_model().objects.create_user(username='financier_api', password='x')
        user.profile.role = UserRoleType.FINANCIER
        user.profile.save()
        self.client.force_authenticate(user=user)
        self.func = FunctionalCode.objects.create(code_api='03 12 00 039', description='ГКСЭ')
        self.econ = ExternalEconomicCode.objects.create(code_api='1 10 10 99', description='Прочие текущие расходы')

    @patch('procurement.views.changeRequest.fin_file_parser.build_preview')
    def test_preview_returns_parsed_lines_without_saving(self, mock_build_preview):
        import os
        from django.core.files.uploadedfile import SimpleUploadedFile
        from procurement.models import ArticleQuarterlyAllocation

        mock_build_preview.return_value = {
            'lines': [{'functional_class': self.func.pk, 'functional_class_detail': self.func,
                       'economic_class': self.econ.pk, 'economic_class_detail': self.econ,
                       'year': 2026, 'quarter': 'Q1', 'amount': Decimal('100.00')}],
            'report': {'rows_total': 1, 'matched_articles': 1, 'excluded': [],
                      'functional_not_found': [], 'economic_not_found': []},
        }
        upload = SimpleUploadedFile('fin_2026.xlsb', b'fake-xlsb-bytes', content_type='application/octet-stream')

        response = self.client.post(
            '/api/change_requests/budget_limit_correction_preview/',
            {'file': upload, 'year': 2026, 'unk': 1534}, format='multipart',
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['lines']), 1)
        self.assertEqual(response.data['lines'][0]['amount'], '100.00')
        self.assertEqual(response.data['lines'][0]['functional_class_detail']['code_api'], '03 12 00 039')
        mock_build_preview.assert_called_once()
        called_path, called_year = mock_build_preview.call_args.args
        self.assertEqual(called_year, 2026)
        self.assertFalse(os.path.exists(called_path))  # временный файл удалён после ответа
        self.assertEqual(ArticleQuarterlyAllocation.objects.count(), 0)  # предпросмотр ничего не пишет в БД

    @patch('procurement.views.changeRequest.fin_file_parser.build_preview')
    def test_preview_returns_400_on_parse_error(self, mock_build_preview):
        from django.core.files.uploadedfile import SimpleUploadedFile

        mock_build_preview.side_effect = ValueError("Sheet 'T' not found")
        upload = SimpleUploadedFile('broken.xlsb', b'not-really-xlsb', content_type='application/octet-stream')

        response = self.client.post(
            '/api/change_requests/budget_limit_correction_preview/',
            {'file': upload, 'year': 2026}, format='multipart',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Sheet 'T' not found", response.data['detail'])

    def test_confirm_applies_correction_immediately_without_review(self):
        """Решение пользователя (2026-11-20): заявка больше не ждёт отдельного
        submit/approve — сохранение из формы на фронте должно сразу сделать корректировку
        действующей (см. cr_service.create_budget_limit_correction())."""
        response = self.client.post(
            '/api/change_requests/budget_limit_correction/',
            {
                'reason': 'fin_2026.xlsb от Казначейства',
                'lines': [{'functional_class': self.func.pk, 'economic_class': self.econ.pk,
                          'year': 2026, 'quarter': 'Q1', 'amount': '9831556.00'}],
            }, format='json',
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['kind'], ChangeRequestKind.BUDGET_LIMIT_CORRECTION)
        self.assertEqual(response.data['status'], ChangeRequestStatus.APPROVED)
        self.assertIsNotNone(response.data['submitted_at'])
        self.assertIsNotNone(response.data['reviewed_at'])

        change_request = ChangeRequest.objects.get(pk=response.data['id'])
        draft = change_request.draft_article_allocations.get()
        self.assertEqual(draft.amount, Decimal('9831556.00'))
        self.assertEqual(draft.quarter, QuarterTypes.Q1)
        self.assertEqual(draft.status, PlanItemStatus.ACTIVE)  # уже действует, не ждёт approve


class AnonymousBudgetLimitCorrectionAccessTestCase(TestCase):
    """Запрос пользователя (2026-11-20): импорт корректировки лимитов — только
    финансист/админ (см. BudgetLimitCorrectionCapabilityTestCase в authentication/tests.py
    для проверки самого permission-класса; здесь — что он реально подключён к вьюсету)."""

    def setUp(self):
        from rest_framework.test import APIClient
        from procurement.models import FunctionalCode, ExternalEconomicCode
        self.client = APIClient()
        self.func = FunctionalCode.objects.create(code_api='03 12 00 039', description='ГКСЭ')
        self.econ = ExternalEconomicCode.objects.create(code_api='1 10 10 99', description='Прочие текущие расходы')

    def test_anonymous_confirm_denied(self):
        response = self.client.post(
            '/api/change_requests/budget_limit_correction/',
            {
                'reason': 'тест',
                'lines': [{'functional_class': self.func.pk, 'economic_class': self.econ.pk,
                          'year': 2026, 'quarter': 'Q1', 'amount': '100.00'}],
            }, format='json',
        )
        # DRF: раз в DEFAULT_AUTHENTICATION_CLASSES есть аутентификаторы, но ни один не
        # сработал (анонимный запрос без токена/сессии) — permission_denied() поднимает
        # NotAuthenticated (401), а не PermissionDenied (403); см.
        # rest_framework.views.APIView.permission_denied().
        self.assertEqual(response.status_code, 401)
        self.assertEqual(ChangeRequest.objects.count(), 0)

    def test_anonymous_preview_denied(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        upload = SimpleUploadedFile('fin_2026.xlsb', b'fake-xlsb-bytes', content_type='application/octet-stream')
        response = self.client.post(
            '/api/change_requests/budget_limit_correction_preview/',
            {'file': upload, 'year': 2026}, format='multipart',
        )
        self.assertEqual(response.status_code, 401)


class MultiYearReservationTestCase(TestCase):
    """Многолетнее резервирование лимитов (Этап 3.1/3.2, ТЗ п.5, пример "ДНК 2026/2027")."""

    def setUp(self):
        self.purchases_2026 = Purchases.objects.create(year=2026)
        self.department = Department.objects.create(full_name='ДНК-держатель', short_name='ДНК')
        self.plan_item = PlanItem.objects.create(plan_purchase=self.purchases_2026, num='2026-TEST-6', is_public=True)
        self.bc_2026 = BudgetCosts.objects.create(
            plan_item=self.plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=6,
            cost=Decimal('10000.00'), year=2026,
        )
        self.share_2026 = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=self.bc_2026, department=self.department,
            shared_amount=Decimal('1'), shared_cost=Decimal('10000.00'),
        )
        supplier = Supplier.objects.create(name='ДНК поставщик')
        self.contract = Contract.objects.create(
            number='DNK-1', supplier=supplier, total_cost=Decimal('4000.00'),
            planned_delivery_date='2027-12-31',
        )
        # Договор заключён под строкой 2026 года, но часть обязательств (ContractItem.year=2027)
        # резервирует деньги на 2027 год — план 2027-го ещё не сформирован.
        self.reserving_item = ContractItem.objects.create(
            contract=self.contract, plan_share=self.share_2026, year=2027,
            contract_amount=Decimal('1'), contract_cost=Decimal('3000.00'),
        )

    def test_reserved_amount_counts_forward_looking_contract_item(self):
        self.assertEqual(compute_reserved_amount(self.plan_item, 2027), Decimal('3000.00'))
        self.assertEqual(compute_reserved_amount(self.plan_item, 2026), Decimal('0'))  # это не резерв "наперёд"

    def test_available_for_distribution_reduced_by_reservation(self):
        bc_2027 = BudgetCosts.objects.create(
            plan_item=self.plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=7,
            cost=Decimal('5000.00'), year=2027,
        )
        self.assertEqual(compute_available_for_distribution(bc_2027), Decimal('2000.00'))  # 5000 - 3000

    def test_plan_share_validation_accounts_for_reservation(self):
        bc_2027 = BudgetCosts.objects.create(
            plan_item=self.plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=8,
            cost=Decimal('5000.00'), year=2027,
        )
        # Доступно 5000 - 3000 = 2000. Попытка распределить больше должна упасть.
        with self.assertRaises(ValidationError):
            PlanShare.objects.create(
                status=PlanItemStatus.ACTIVE, budget_cost=bc_2027, department=self.department,
                shared_amount=Decimal('1'), shared_cost=Decimal('2000.01'),
            )
        # Ровно доступный остаток — проходит.
        share_2027 = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=bc_2027, department=self.department,
            shared_amount=Decimal('1'), shared_cost=Decimal('2000.00'),
        )
        self.assertEqual(share_2027.shared_cost, Decimal('2000.00'))

    def test_contract_item_under_own_year_budget_cost_not_double_counted(self):
        bc_2027 = BudgetCosts.objects.create(
            plan_item=self.plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=9,
            cost=Decimal('5000.00'), year=2027,
        )
        share_2027 = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=bc_2027, department=self.department,
            shared_amount=Decimal('1'), shared_cost=Decimal('2000.00'),
        )
        # Новый ContractItem заведён УЖЕ под строкой 2027 года — это обычная текущая история
        # договора того года, а не резерв "наперёд", не должен попадать в расчёт резерва.
        ContractItem.objects.create(
            contract=self.contract, plan_share=share_2027, year=2027,
            contract_amount=Decimal('1'), contract_cost=Decimal('500.00'),
        )
        self.assertEqual(compute_reserved_amount(self.plan_item, 2027), Decimal('3000.00'))  # не 3500


class TreasuryPaymentSearchAndDateRangeFilterTestCase(TestCase):
    """Запрос фронтенда (2026-11-18): поиск по примечанию и фильтр по периоду дат платежа
    в GET /api/payments/ (views/treasuryPayment.py::TreasuryPaymentFilter)."""

    def setUp(self):
        kind = KindOfPayment.objects.create(name='Тестовый платёж (поиск/период)')
        self.p1 = TreasuryPayment.objects.create(
            amount=Decimal('10.00'), kind=kind, payment_date='2026-01-15',
            notice='Сопровождение АИПСИН Драгс', program_class=None,
        )
        self.p2 = TreasuryPayment.objects.create(
            amount=Decimal('20.00'), kind=kind, payment_date='2026-06-10',
            notice='Другой платёж без совпадения', program_class=None,
        )

    def test_search_matches_notice_case_insensitively(self):
        from rest_framework.request import Request
        from rest_framework.test import APIRequestFactory
        from rest_framework import filters
        from procurement.views.treasuryPayment import TreasuryPaymentViewSet

        factory = APIRequestFactory()
        request = Request(factory.get('/api/payments/', {'search': 'аипсин'}))
        view = TreasuryPaymentViewSet()
        view.request = request
        qs = filters.SearchFilter().filter_queryset(request, TreasuryPayment.objects.all(), view)
        self.assertEqual(list(qs), [self.p1])

    def test_date_range_filter_is_inclusive_on_both_ends(self):
        from procurement.views.treasuryPayment import TreasuryPaymentFilter
        qs = TreasuryPaymentFilter(
            {'payment_date_after': '2026-01-15', 'payment_date_before': '2026-01-15'},
            queryset=TreasuryPayment.objects.all(),
        ).qs
        self.assertIn(self.p1, qs)
        self.assertNotIn(self.p2, qs)

    def test_date_range_filter_excludes_outside_range(self):
        from procurement.views.treasuryPayment import TreasuryPaymentFilter
        qs = TreasuryPaymentFilter(
            {'payment_date_after': '2026-02-01', 'payment_date_before': '2026-12-31'},
            queryset=TreasuryPayment.objects.all(),
        ).qs
        self.assertNotIn(self.p1, qs)
        self.assertIn(self.p2, qs)


class TreasuryPaymentCodeFilterTestCase(TestCase):
    """Запрос пользователя (2026-11-26): на странице «Платежи» нужны фильтры по статье ЭКР
    (`economic_class`), параграфу (`functional_class`) и внутреннему коду ЭКР
    (`internal_economic_class`) — все три — прямые FK на `TreasuryPayment`, доводятся
    авто-генерируемым `django_filters.FilterSet` (точное совпадение по id), по той же схеме,
    что уже был фильтр `departments` (M2M)."""

    def setUp(self):
        from procurement.models import FunctionalCode, ExternalEconomicCode

        kind = KindOfPayment.objects.create(name='Тестовый платёж (фильтр по кодам)')
        self.func_a = FunctionalCode.objects.create(code_api='03 12 00 039', description='Параграф A')
        self.func_b = FunctionalCode.objects.create(code_api='03 12 00 042', description='Параграф Б')
        self.econ_a = ExternalEconomicCode.objects.create(code_api='1 10 10 99', description='Статья A')
        self.econ_b = ExternalEconomicCode.objects.create(code_api='2 40 01 00', description='Статья Б')
        self.iec_a = InternalEconomicClassifier.objects.create(code='1101008173', name='Внутр. код A')
        self.iec_b = InternalEconomicClassifier.objects.create(code='1101008999', name='Внутр. код Б')

        self.payment_a = TreasuryPayment.objects.create(
            amount=Decimal('10.00'), kind=kind, payment_date='2026-01-15', program_class=None,
            functional_class=self.func_a, economic_class=self.econ_a, internal_economic_class=self.iec_a,
        )
        self.payment_b = TreasuryPayment.objects.create(
            amount=Decimal('20.00'), kind=kind, payment_date='2026-01-16', program_class=None,
            functional_class=self.func_b, economic_class=self.econ_b, internal_economic_class=self.iec_b,
        )

    def _ids(self, **query):
        response = self.client.get('/api/payments/', query)
        self.assertEqual(response.status_code, 200)
        return {row['id'] for row in response.json()['results']}

    def test_filter_by_functional_class(self):
        self.assertEqual(self._ids(functional_class=self.func_a.id), {self.payment_a.id})

    def test_filter_by_economic_class(self):
        self.assertEqual(self._ids(economic_class=self.econ_b.id), {self.payment_b.id})

    def test_filter_by_internal_economic_class(self):
        self.assertEqual(self._ids(internal_economic_class=self.iec_a.id), {self.payment_a.id})

    def test_no_filter_returns_both(self):
        self.assertEqual(self._ids(), {self.payment_a.id, self.payment_b.id})


class TreasuryPaymentAutoRecomputeTestCase(TestCase):
    """Этап 4.3: автоматический пересчёт факта квартального плана договора по платёжкам."""

    def setUp(self):
        self.kind_normal = KindOfPayment.objects.create(name='Тестовый платёж 4.3')
        self.kind_refund = KindOfPayment.objects.create(name='Тестовый возврат 4.3', is_refund=True)
        supplier = Supplier.objects.create(name='Тестовый поставщик 4.3')
        self.contract = Contract.objects.create(
            number='T-43', supplier=supplier, total_cost=Decimal('1000.00'), planned_delivery_date='2026-12-31',
        )

    def test_payment_creates_summary_quarterly_finance_row(self):
        TreasuryPayment.objects.create(
            amount=Decimal('300.00'), kind=self.kind_normal, contract=self.contract,
            payment_year=2026, payment_date='2026-02-01', program_class=None,
        )
        cqf = ContractQuarterlyFinance.objects.get(contract=self.contract, contract_item__isnull=True)
        self.assertEqual(cqf.quarter, QuarterTypes.Q1)
        self.assertEqual(cqf.year, 2026)
        self.assertEqual(cqf.planned_cost, Decimal('300.00'))
        self.assertEqual(cqf.actual_cost, Decimal('300.00'))

    def test_second_payment_updates_existing_row_net_of_refund(self):
        TreasuryPayment.objects.create(
            amount=Decimal('300.00'), kind=self.kind_normal, contract=self.contract,
            payment_year=2026, payment_date='2026-02-01', program_class=None,
        )
        TreasuryPayment.objects.create(
            amount=Decimal('50.00'), kind=self.kind_refund, contract=self.contract,
            payment_year=2026, payment_date='2026-03-01', program_class=None,
        )
        cqf = ContractQuarterlyFinance.objects.get(contract=self.contract, contract_item__isnull=True)
        self.assertEqual(cqf.actual_cost, Decimal('250.00'))  # 300 - 50 (возврат), тот же квартал Q1

    def test_overspend_rejected_and_payment_not_persisted(self):
        TreasuryPayment.objects.create(
            amount=Decimal('1000.00'), kind=self.kind_normal, contract=self.contract,
            payment_year=2026, payment_date='2026-02-01', program_class=None,
        )
        with self.assertRaises(ValidationError):
            TreasuryPayment.objects.create(
                amount=Decimal('0.01'), kind=self.kind_normal, contract=self.contract,
                payment_year=2026, payment_date='2026-03-01', program_class=None,
            )
        # Транзакция должна откатиться целиком — отвергнутый платёж не создан
        self.assertEqual(TreasuryPayment.objects.filter(contract=self.contract).count(), 1)

    def test_deleting_payment_reduces_recomputed_actual(self):
        payment = TreasuryPayment.objects.create(
            amount=Decimal('300.00'), kind=self.kind_normal, contract=self.contract,
            payment_year=2026, payment_date='2026-02-01', program_class=None,
        )
        payment.delete()
        cqf = ContractQuarterlyFinance.objects.get(contract=self.contract, contract_item__isnull=True)
        self.assertEqual(cqf.actual_cost, Decimal('0'))

    def test_payment_mirrored_from_import_does_not_duplicate_breakdown_row(self):
        """Баг найден 2026-11-18 (сообщение фронтенда): import_reestr26.py зеркалирует импортные
        платёжки в TreasuryPayment — сохранение каждой из них триггерило этот же сигнал и
        штамповало лишнюю "сводную" (contract_item=None) запись рядом с уже существующей точной
        contract_item-разбивкой. Проверяем, что сигнал теперь её не создаёт — а если она уже
        есть (унаследованный дубль), удаляет."""
        department = Department.objects.create(full_name='Тестовое управление 4.3г', short_name='ТУ4.3г')
        purchases = Purchases.objects.create(year=2026)
        plan_item = PlanItem.objects.create(plan_purchase=purchases, num='2026-TEST-43g', is_public=True)
        budget_cost = BudgetCosts.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=99,
            cost=Decimal('300.00'), year=2026,
        )
        plan_share = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=budget_cost, department=department,
            shared_amount=Decimal('1'), shared_cost=Decimal('300.00'),
        )
        contract_item = ContractItem.objects.create(
            contract=self.contract, plan_share=plan_share, year=2026,
            contract_amount=Decimal('1'), contract_cost=Decimal('300.00'),
        )
        ContractQuarterlyFinance.objects.create(
            contract=self.contract, contract_item=contract_item, quarter=QuarterTypes.Q1, year=2026,
            planned_cost=Decimal('300.00'), actual_cost=Decimal('300.00'),
        )

        # Зеркалирование импортной платёжки на тот же договор/квартал — не должно создать
        # "сводную" запись-дубль.
        TreasuryPayment.objects.create(
            amount=Decimal('300.00'), kind=self.kind_normal, contract=self.contract,
            payment_year=2026, payment_date='2026-02-01', program_class=None,
        )
        self.assertFalse(
            ContractQuarterlyFinance.objects.filter(contract=self.contract, contract_item__isnull=True).exists()
        )

        # Унаследованный дубль (созданный до фикса) должен удаляться при следующем пересчёте.
        ContractQuarterlyFinance.objects.create(
            contract=self.contract, contract_item=None, quarter=QuarterTypes.Q1, year=2026,
            planned_cost=Decimal('300.00'), actual_cost=Decimal('300.00'),
        )
        TreasuryPayment.objects.create(
            amount=Decimal('0.01'), kind=self.kind_refund, contract=self.contract,
            payment_year=2026, payment_date='2026-02-02', program_class=None,
        )
        self.assertFalse(
            ContractQuarterlyFinance.objects.filter(contract=self.contract, contract_item__isnull=True).exists()
        )


class TreasuryPaymentSerializerValidationTestCase(TestCase):
    """Этап 4.1: сериализатор должен возвращать чистую ошибку валидации (400), а не
    необработанное исключение модели — покрывает исторический баг (validate() был мёртвым
    кодом внутри Meta, см. CurrentStatus.md Этап 4.1)."""

    def setUp(self):
        self.kind_normal = KindOfPayment.objects.create(name='Тестовый платёж 4.1')
        supplier = Supplier.objects.create(name='Тестовый поставщик 4.1')
        self.contract = Contract.objects.create(
            number='T-41', supplier=supplier, total_cost=Decimal('100.00'), planned_delivery_date='2026-12-31',
        )

    def test_zero_amount_rejected_by_serializer_validate(self):
        serializer = TreasuryPaymentSerializer(data={'amount': '0', 'payment_date': '2026-02-01'})
        self.assertFalse(serializer.is_valid())
        self.assertIn('amount', serializer.errors)

    def test_free_payment_without_contract_is_valid(self):
        serializer = TreasuryPaymentSerializer(data={
            'amount': '25.50', 'payment_date': '2026-02-01', 'departments': [], 'kind': self.kind_normal.pk,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)

    def test_overspend_rejected_by_serializer_validate(self):
        TreasuryPayment.objects.create(
            amount=Decimal('100.00'), kind=self.kind_normal, contract=self.contract,
            payment_year=2026, payment_date='2026-02-01', program_class=None,
        )
        serializer = TreasuryPaymentSerializer(data={
            'contract': self.contract.pk, 'amount': '1.00', 'payment_date': '2026-03-01',
            'kind': self.kind_normal.pk,
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('amount', serializer.errors)


class ContractQuarterlyFinanceSerializerValidationTestCase(TestCase):
    """Этап 4.3: ручная корректировка квартального плана через сериализатор — тоже должна
    возвращать чистый 400 при попытке превысить сумму договора нарастающим итогом."""

    def setUp(self):
        supplier = Supplier.objects.create(name='Тестовый поставщик 4.3б')
        self.contract = Contract.objects.create(
            number='T-43b', supplier=supplier, total_cost=Decimal('100.00'), planned_delivery_date='2026-12-31',
        )

    def test_planned_cost_can_be_corrected_manually(self):
        cqf = ContractQuarterlyFinance.objects.create(
            contract=self.contract, quarter=QuarterTypes.Q1, year=2026,
            planned_cost=Decimal('25.00'), actual_cost=Decimal('0'),
        )
        serializer = ContractQuarterlyFinanceSerializer(cqf, data={'planned_cost': '40.00'}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        cqf.refresh_from_db()
        self.assertEqual(cqf.planned_cost, Decimal('40.00'))

    def test_actual_cost_overspend_rejected(self):
        cqf = ContractQuarterlyFinance.objects.create(
            contract=self.contract, quarter=QuarterTypes.Q1, year=2026,
            planned_cost=Decimal('25.00'), actual_cost=Decimal('0'),
        )
        serializer = ContractQuarterlyFinanceSerializer(cqf, data={'actual_cost': '150.00'}, partial=True)
        self.assertFalse(serializer.is_valid())
        self.assertIn('actual_cost', serializer.errors)


class ContractGetQuarterlyFinanceTestCase(TestCase):
    """Этап 4.3: Contract.get_quarterly_finance() — реальная (не прогнозная) агрегация
    план/факт по кварталам, просуммированная по всем строкам договора."""

    def setUp(self):
        supplier = Supplier.objects.create(name='Тестовый поставщик 4.3в')
        self.contract = Contract.objects.create(
            number='T-43c', supplier=supplier, total_cost=Decimal('300.00'), planned_delivery_date='2026-12-31',
        )

    def test_aggregates_across_contract_items_by_quarter(self):
        ContractQuarterlyFinance.objects.create(
            contract=self.contract, contract_item=None, quarter=QuarterTypes.Q1, year=2026,
            planned_cost=Decimal('100.00'), actual_cost=Decimal('80.00'),
        )
        ContractQuarterlyFinance.objects.create(
            contract=self.contract, contract_item=None, quarter=QuarterTypes.Q2, year=2026,
            planned_cost=Decimal('200.00'), actual_cost=Decimal('0'),
        )
        result = self.contract.get_quarterly_finance()
        self.assertEqual(len(result), 2)
        q1 = next(r for r in result if r['quarter'] == QuarterTypes.Q1)
        self.assertEqual(q1['planned_cost'], Decimal('100.00'))
        self.assertEqual(q1['actual_cost'], Decimal('80.00'))


class ContractExpiringWithinDaysFilterTestCase(TestCase):
    """Запрос пользователя (2026-11-18): фильтр "срок исполнения скоро истекает" в разделе
    «Договоры» (все договоры) — ContractFilter.expiring_within_days (views/contract.py)."""

    def setUp(self):
        import datetime
        from django.utils import timezone
        supplier = Supplier.objects.create(name='Тестовый поставщик expiring')
        self.today = timezone.now().date()
        self.soon = Contract.objects.create(
            number='T-EXP-SOON', supplier=supplier, total_cost=Decimal('1.00'),
            planned_delivery_date=self.today + datetime.timedelta(days=3),
        )
        self.today_itself = Contract.objects.create(
            number='T-EXP-TODAY', supplier=supplier, total_cost=Decimal('1.00'),
            planned_delivery_date=self.today,
        )
        self.far_away = Contract.objects.create(
            number='T-EXP-FAR', supplier=supplier, total_cost=Decimal('1.00'),
            planned_delivery_date=self.today + datetime.timedelta(days=60),
        )
        self.overdue = Contract.objects.create(
            number='T-EXP-OVERDUE', supplier=supplier, total_cost=Decimal('1.00'),
            planned_delivery_date=self.today - datetime.timedelta(days=5),
        )

    def test_filters_to_contracts_due_within_n_days(self):
        from procurement.views.contract import ContractFilter
        qs = ContractFilter({'expiring_within_days': '5'}, queryset=Contract.objects.all()).qs
        self.assertIn(self.soon, qs)
        self.assertIn(self.today_itself, qs)
        self.assertNotIn(self.far_away, qs)
        self.assertNotIn(self.overdue, qs)


class ContractDepartmentFilterTestCase(TestCase):
    """Запрос фронтенда (2026-11-21, следом за тем же фильтром у /api/plan_items/,
    см. CurrentStatus.md): ?department=<id> на /api/contracts/ — подразделение
    определяется через спецификацию (ContractItem.plan_share.department), у одного
    договора может быть несколько строк с разными подразделениями."""

    def _make_contract_item(self, contract, department, *, num_suffix, purchases_items_id):
        purchases = Purchases.objects.create(year=2026)
        plan_item = PlanItem.objects.create(plan_purchase=purchases, num=f'2026-TEST-CD-{num_suffix}', is_public=True)
        PlanItemDetail.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, num=f'2026-TEST-CD-{num_suffix}',
            title='Тест фильтра подразделения', okrb='00.00.00.000', val_amount=Decimal('1'),
        )
        budget_cost = BudgetCosts.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=purchases_items_id,
            cost=Decimal('100.00'), year=2026,
        )
        plan_share = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=budget_cost, department=department,
            shared_amount=Decimal('1'), shared_cost=Decimal('100.00'),
        )
        return ContractItem.objects.create(
            contract=contract, plan_share=plan_share, year=2026,
            contract_amount=Decimal('1'), contract_cost=Decimal('100.00'),
        )

    def setUp(self):
        supplier = Supplier.objects.create(name='Тестовый поставщик department-filter')
        self.dept_1 = Department.objects.create(full_name='Управление CD-1', short_name='CD1')
        self.dept_2 = Department.objects.create(full_name='Управление CD-2', short_name='CD2')

        # Договор только с dept_1.
        self.contract_1 = Contract.objects.create(
            number='T-DEP-1', supplier=supplier, total_cost=Decimal('100.00'),
            planned_delivery_date='2026-12-31',
        )
        self._make_contract_item(self.contract_1, self.dept_1, num_suffix=1, purchases_items_id=301)

        # Договор с двумя строками спецификации (dept_1 и dept_2) — проверка distinct().
        self.contract_2 = Contract.objects.create(
            number='T-DEP-2', supplier=supplier, total_cost=Decimal('200.00'),
            planned_delivery_date='2026-12-31',
        )
        self._make_contract_item(self.contract_2, self.dept_1, num_suffix=2, purchases_items_id=302)
        self._make_contract_item(self.contract_2, self.dept_2, num_suffix=3, purchases_items_id=303)

        # Договор только с dept_2.
        self.contract_3 = Contract.objects.create(
            number='T-DEP-3', supplier=supplier, total_cost=Decimal('50.00'),
            planned_delivery_date='2026-12-31',
        )
        self._make_contract_item(self.contract_3, self.dept_2, num_suffix=4, purchases_items_id=304)

    def _ids(self, **query):
        response = self.client.get('/api/contracts/', query)
        self.assertEqual(response.status_code, 200)
        return {row['id'] for row in response.json()['results']}

    def test_filter_by_department(self):
        self.assertEqual(self._ids(department=self.dept_1.id), {self.contract_1.id, self.contract_2.id})
        self.assertEqual(self._ids(department=self.dept_2.id), {self.contract_2.id, self.contract_3.id})

    def test_no_filter_returns_all(self):
        self.assertEqual(
            self._ids(), {self.contract_1.id, self.contract_2.id, self.contract_3.id},
        )


class ContractCodeFilterTestCase(TestCase):
    """Запрос пользователя (2026-11-26): на странице «Договоры» нужны фильтры по статье
    ЭКР/параграфу/внутреннему коду ЭКР — та же цепочка `items__plan_share__budget_cost__...`,
    что уже был `department` (через `items__plan_share__department`), см.
    `ContractDepartmentFilterTestCase` выше."""

    def _make_contract_item(self, contract, *, num_suffix, purchases_items_id,
                             functional_class=None, economic_class=None, internal_economic_class=None):
        purchases = Purchases.objects.create(year=2026)
        plan_item = PlanItem.objects.create(plan_purchase=purchases, num=f'2026-TEST-CC-{num_suffix}', is_public=True)
        PlanItemDetail.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, num=f'2026-TEST-CC-{num_suffix}',
            title='Тест фильтра по кодам ЭКР', okrb='00.00.00.000', val_amount=Decimal('1'),
        )
        budget_cost = BudgetCosts.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=purchases_items_id,
            cost=Decimal('100.00'), year=2026,
            functional_class=functional_class, economic_class=economic_class,
            internal_economic_class=internal_economic_class,
        )
        plan_share = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=budget_cost, department=self.dept,
            shared_amount=Decimal('1'), shared_cost=Decimal('100.00'),
        )
        return ContractItem.objects.create(
            contract=contract, plan_share=plan_share, year=2026,
            contract_amount=Decimal('1'), contract_cost=Decimal('100.00'),
        )

    def setUp(self):
        from procurement.models import FunctionalCode, ExternalEconomicCode

        supplier = Supplier.objects.create(name='Тестовый поставщик code-filter')
        self.dept = Department.objects.create(full_name='Управление CC', short_name='CC')
        self.func_a = FunctionalCode.objects.create(code_api='03 12 00 039', description='Параграф A')
        self.func_b = FunctionalCode.objects.create(code_api='03 12 00 042', description='Параграф Б')
        self.econ_a = ExternalEconomicCode.objects.create(code_api='1 10 10 99', description='Статья A')
        self.econ_b = ExternalEconomicCode.objects.create(code_api='2 40 01 00', description='Статья Б')
        self.iec_a = InternalEconomicClassifier.objects.create(code='1101008173', name='Внутр. код A')
        self.iec_b = InternalEconomicClassifier.objects.create(code='1101008999', name='Внутр. код Б')

        self.contract_a = Contract.objects.create(
            number='T-CC-1', supplier=supplier, total_cost=Decimal('100.00'), planned_delivery_date='2026-12-31',
        )
        self._make_contract_item(
            self.contract_a, num_suffix=1, purchases_items_id=401,
            functional_class=self.func_a, economic_class=self.econ_a, internal_economic_class=self.iec_a,
        )

        self.contract_b = Contract.objects.create(
            number='T-CC-2', supplier=supplier, total_cost=Decimal('200.00'), planned_delivery_date='2026-12-31',
        )
        self._make_contract_item(
            self.contract_b, num_suffix=2, purchases_items_id=402,
            functional_class=self.func_b, economic_class=self.econ_b, internal_economic_class=self.iec_b,
        )

    def _ids(self, **query):
        response = self.client.get('/api/contracts/', query)
        self.assertEqual(response.status_code, 200)
        return {row['id'] for row in response.json()['results']}

    def test_filter_by_functional_class(self):
        self.assertEqual(self._ids(functional_class=self.func_a.id), {self.contract_a.id})

    def test_filter_by_economic_class(self):
        self.assertEqual(self._ids(economic_class=self.econ_b.id), {self.contract_b.id})

    def test_filter_by_internal_economic_class(self):
        self.assertEqual(self._ids(internal_economic_class=self.iec_a.id), {self.contract_a.id})

    def test_no_filter_returns_all(self):
        self.assertEqual(self._ids(), {self.contract_a.id, self.contract_b.id})


class BackfillContractBuyerCommandTestCase(TestCase):
    """Запрос пользователя (2026-11-18): Contract.buyer исторически не заполнялся импортом —
    backfill_contract_buyer.py выводит его из PlanItemDetail.buyer по всем строкам
    спецификации, только если закупщик один и тот же везде."""

    def _make_contract_item(self, contract, buyer, *, num_suffix, purchases_items_id):
        purchases = Purchases.objects.create(year=2026)
        plan_item = PlanItem.objects.create(plan_purchase=purchases, num=f'2026-TEST-BF-{num_suffix}', is_public=True)
        PlanItemDetail.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, num=f'2026-TEST-BF-{num_suffix}',
            title='Тест backfill', okrb='00.00.00.000', val_amount=Decimal('1'), buyer=buyer,
        )
        budget_cost = BudgetCosts.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=purchases_items_id,
            cost=Decimal('100.00'), year=2026,
        )
        plan_share = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=budget_cost, department=self.department,
            shared_amount=Decimal('1'), shared_cost=Decimal('100.00'),
        )
        return ContractItem.objects.create(
            contract=contract, plan_share=plan_share, year=2026,
            contract_amount=Decimal('1'), contract_cost=Decimal('100.00'),
        )

    def setUp(self):
        self.department = Department.objects.create(full_name='Тестовое управление BF', short_name='ТУbf')
        self.buyer_a = Buyer.objects.create(full_name='Закупщик А', shot_name='ЗА')
        self.buyer_b = Buyer.objects.create(full_name='Закупщик Б', shot_name='ЗБ')
        supplier = Supplier.objects.create(name='Тестовый поставщик backfill')
        self.contract_single = Contract.objects.create(
            number='T-BF-SINGLE', supplier=supplier, total_cost=Decimal('100.00'), planned_delivery_date='2026-12-31',
        )
        self._make_contract_item(self.contract_single, self.buyer_a, num_suffix='1', purchases_items_id=101)

        self.contract_conflict = Contract.objects.create(
            number='T-BF-CONFLICT', supplier=supplier, total_cost=Decimal('200.00'), planned_delivery_date='2026-12-31',
        )
        self._make_contract_item(self.contract_conflict, self.buyer_a, num_suffix='2', purchases_items_id=102)
        self._make_contract_item(self.contract_conflict, self.buyer_b, num_suffix='3', purchases_items_id=103)

        self.contract_no_buyer = Contract.objects.create(
            number='T-BF-NONE', supplier=supplier, total_cost=Decimal('50.00'), planned_delivery_date='2026-12-31',
        )
        self._make_contract_item(self.contract_no_buyer, None, num_suffix='4', purchases_items_id=104)

    def test_dry_run_does_not_persist_changes(self):
        from django.core.management import call_command
        call_command('backfill_contract_buyer')
        self.contract_single.refresh_from_db()
        self.assertIsNone(self.contract_single.buyer)

    def test_apply_resolves_unambiguous_buyer_and_skips_conflict_and_empty(self):
        from django.core.management import call_command
        call_command('backfill_contract_buyer', '--apply')
        self.contract_single.refresh_from_db()
        self.contract_conflict.refresh_from_db()
        self.contract_no_buyer.refresh_from_db()
        self.assertEqual(self.contract_single.buyer_id, self.buyer_a.pk)
        self.assertIsNone(self.contract_conflict.buyer)
        self.assertIsNone(self.contract_no_buyer.buyer)

class GoszakupkiPushTestCase(TestCase):
    """Этап 5: отправка позиций ГПЗ на goszakupki.by (create-item/update-item/delete-items,
    строго по doc/api.yaml) — реальный API недоступен из этой среды, поэтому клиент мокается."""

    def setUp(self):
        self.purchases = Purchases.objects.create(year=2026, purchase_id=68009)
        self.plan_item = PlanItem.objects.create(
            plan_purchase=self.purchases, num='2026-TEST-GZ-1', is_public=True,
        )
        self.detail = PlanItemDetail.objects.create(
            plan_item=self.plan_item, status=PlanItemStatus.ACTIVE, num='2026-TEST-GZ-1',
            title='Тестовая позиция для push', okrb='00.00.00.000', val_amount=Decimal('5'),
            purchases_id=68009,
        )
        self.budget_cost = BudgetCosts.objects.create(
            plan_item=self.plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=1,
            cost=Decimal('1000.00'), year=2026,
            functional_code='03 12 00 039', economic_code='1 10 10 99',
            program_code='099 00', department_code='010', budget_code=1,
        )

    @patch('procurement.services.goszakupki_push.GoszakupkiAPI')
    def test_create_when_no_purchases_item_id(self, mock_api_cls):
        mock_client = mock_api_cls.return_value
        mock_client.post_data.return_value = ({'id': 999, 'num': '2026-102377498-999'}, {})

        result = goszakupki_push.push_plan_item(self.plan_item)

        mock_client.post_data.assert_called_once()
        called_endpoint = mock_client.post_data.call_args[0][0]
        self.assertEqual(called_endpoint, '/purchase/create-item/68009')
        payload = mock_client.post_data.call_args[0][1]
        self.assertEqual(payload['title'], 'Тестовая позиция для push')
        self.assertEqual(len(payload['budget_costs']), 1)
        self.assertEqual(payload['budget_costs'][0]['functional_code'], '03 12 00 039')

        self.detail.refresh_from_db()
        self.plan_item.refresh_from_db()
        self.assertEqual(self.detail.purchases_item_id, 999)
        self.assertEqual(self.plan_item.num, '2026-102377498-999')
        self.assertEqual(result['action'], 'create')

    @patch('procurement.services.goszakupki_push.GoszakupkiAPI')
    def test_update_when_purchases_item_id_present(self, mock_api_cls):
        self.detail.purchases_item_id = 555
        self.detail.save(update_fields=['purchases_item_id'])
        mock_client = mock_api_cls.return_value
        mock_client.put_data.return_value = ({'id': 555}, {})

        result = goszakupki_push.push_plan_item(self.plan_item)

        mock_client.put_data.assert_called_once()
        self.assertEqual(mock_client.put_data.call_args[0][0], '/purchase/update-item/555')
        self.assertEqual(result['action'], 'update')
        mock_client.post_data.assert_not_called()

    def test_non_public_item_rejected(self):
        self.plan_item.is_public = False
        self.plan_item.save(update_fields=['is_public'])
        with self.assertRaises(ValueError):
            goszakupki_push.push_plan_item(self.plan_item)

    @patch('procurement.services.goszakupki_push.GoszakupkiAPI')
    def test_delete_groups_by_purchases_id(self, mock_api_cls):
        self.detail.purchases_item_id = 777
        self.detail.save(update_fields=['purchases_item_id'])
        mock_client = mock_api_cls.return_value
        mock_client.put_data.return_value = ([777], {})

        result = goszakupki_push.delete_plan_items([self.plan_item.id])

        mock_client.put_data.assert_called_once_with('/purchase/delete-items/68009', {'ids': [777]})
        self.assertEqual(result['deleted_purchases_item_ids'], [777])
        self.assertEqual(result['skipped'], [])

    def test_delete_skips_items_without_portal_ids(self):
        result = goszakupki_push.delete_plan_items([self.plan_item.id])
        self.assertEqual(len(result['skipped']), 1)
        self.assertEqual(result['deleted_purchases_item_ids'], [])


class DepartmentArticleLimitDirectEditTestCase(TestCase):
    """Страница «Распределение лимитов» (решение пользователя 2026-11-23) — правится
    напрямую (CRUD + activate), без ChangeRequest/согласования. Доступ — только финансист/
    админ (CAPABILITIES['department_limits']) — здесь аутентифицируемся финансистом, саму
    проверку прав см. в DepartmentLimitsCapabilityTestCase (authentication/tests.py)."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        from rest_framework.test import APIClient
        from procurement.models import FunctionalCode, ExternalEconomicCode, ArticleQuarterlyAllocation

        self.client = APIClient()
        user = get_user_model().objects.create_user(username='financier_dl', password='x')
        user.profile.role = UserRoleType.FINANCIER
        user.profile.save()
        self.client.force_authenticate(user=user)

        self.func = FunctionalCode.objects.create(code_api='03 12 00 039', description='ГКСЭ')
        self.econ = ExternalEconomicCode.objects.create(code_api='1 10 03 99', description='Расходные материалы')
        self.iec = InternalEconomicClassifier.objects.create(code='1100300001', name='Подстатья А')
        self.dept1 = Department.objects.create(full_name='Отдел 1', short_name='О1')
        self.dept2 = Department.objects.create(full_name='Отдел 2', short_name='О2')
        for q in [QuarterTypes.Q1, QuarterTypes.Q2, QuarterTypes.Q3, QuarterTypes.Q4]:
            ArticleQuarterlyAllocation.objects.create(
                functional_class=self.func, economic_class=self.econ, year=2026, quarter=q,
                amount=Decimal('125000.00'),
            )
        # Итого по статье за год: 500000.00

    def _create_draft(self, department, amount):
        response = self.client.post('/api/department_article_limits/', {
            'functional_class': self.func.pk, 'economic_class': self.econ.pk,
            'internal_economic_class': self.iec.pk, 'department': department.pk,
            'year': 2026, 'amount': str(amount),
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_new_record_defaults_to_draft(self):
        data = self._create_draft(self.dept1, Decimal('200000.00'))
        self.assertEqual(data['status'], PlanItemStatus.DRAFT)

    def test_activate_promotes_draft_to_active(self):
        from procurement.models import DepartmentArticleLimit
        data = self._create_draft(self.dept1, Decimal('200000.00'))

        response = self.client.post(f"/api/department_article_limits/{data['id']}/activate/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], PlanItemStatus.ACTIVE)
        self.assertEqual(DepartmentArticleLimit.objects.get(pk=data['id']).status, PlanItemStatus.ACTIVE)

    def test_activate_archives_previous_active_with_same_combo(self):
        """Решение пользователя (2026-11-23): «Активировать» делает архивными все записи-
        лимиты ВЫБРАННОГО подразделения по выбранному параграфу-статье и внутреннему коду —
        история версий лимита сохраняется построчно."""
        from procurement.models import DepartmentArticleLimit
        first = self._create_draft(self.dept1, Decimal('200000.00'))
        self.client.post(f"/api/department_article_limits/{first['id']}/activate/")

        second = self._create_draft(self.dept1, Decimal('250000.00'))
        response = self.client.post(f"/api/department_article_limits/{second['id']}/activate/")
        self.assertEqual(response.status_code, 200)

        old = DepartmentArticleLimit.objects.get(pk=first['id'])
        self.assertEqual(old.status, PlanItemStatus.ARCHIVE)
        self.assertIsNotNone(old.deactivated_at)
        new = DepartmentArticleLimit.objects.get(pk=second['id'])
        self.assertEqual(new.status, PlanItemStatus.ACTIVE)

        # Другое подразделение с той же статьёй/подстатьёй не затрагивается.
        other = self._create_draft(self.dept2, Decimal('100000.00'))
        self.client.post(f"/api/department_article_limits/{other['id']}/activate/")
        self.assertEqual(
            DepartmentArticleLimit.objects.filter(status=PlanItemStatus.ACTIVE).count(), 2,
        )

    def test_activate_non_draft_rejected(self):
        data = self._create_draft(self.dept1, Decimal('200000.00'))
        self.client.post(f"/api/department_article_limits/{data['id']}/activate/")  # -> ACTIVE

        response = self.client.post(f"/api/department_article_limits/{data['id']}/activate/")
        self.assertEqual(response.status_code, 400)

    def test_patch_note_on_active_record_allowed(self):
        data = self._create_draft(self.dept1, Decimal('200000.00'))
        self.client.post(f"/api/department_article_limits/{data['id']}/activate/")

        response = self.client.patch(
            f"/api/department_article_limits/{data['id']}/", {'note': 'уточнение'}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['note'], 'уточнение')

    def test_patch_statya_on_active_record_without_amount_change_edits_in_place(self):
        """Решение пользователя (2026-11-26): исправление ошибочно выбранной статьи/
        параграфа/подразделения/примечания на ACTIVE-записи, БЕЗ изменения суммы — правится
        на месте, тот же id, запись остаётся ACTIVE (не версионируется)."""
        from procurement.models import DepartmentArticleLimit, ExternalEconomicCode

        other_econ = ExternalEconomicCode.objects.create(code_api='1 10 04 00', description='Другая статья')
        data = self._create_draft(self.dept1, Decimal('200000.00'))
        self.client.post(f"/api/department_article_limits/{data['id']}/activate/")

        response = self.client.patch(
            f"/api/department_article_limits/{data['id']}/",
            {
                'economic_class': other_econ.pk, 'department': self.dept2.pk,
                'note': 'исправлена ошибочная статья/подразделение',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['id'], data['id'])
        self.assertEqual(response.data['status'], PlanItemStatus.ACTIVE)
        self.assertEqual(response.data['economic_class'], other_econ.pk)
        self.assertEqual(response.data['department'], self.dept2.pk)
        self.assertEqual(Decimal(response.data['amount']), Decimal('200000.00'))

        record = DepartmentArticleLimit.objects.get(pk=data['id'])
        self.assertEqual(record.status, PlanItemStatus.ACTIVE)
        self.assertEqual(record.economic_class_id, other_econ.pk)
        self.assertEqual(record.department_id, self.dept2.pk)

    def test_patch_amount_only_on_active_record_versions_as_new_record(self):
        """Решение пользователя (2026-11-26): если меняется ТОЛЬКО сумма — старая запись
        архивируется, создаётся новая ACTIVE со всеми прочими полями без изменений."""
        from procurement.models import DepartmentArticleLimit

        data = self._create_draft(self.dept1, Decimal('200000.00'))
        self.client.post(f"/api/department_article_limits/{data['id']}/activate/")

        response = self.client.patch(
            f"/api/department_article_limits/{data['id']}/", {'amount': '250000.00'}, format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertNotEqual(response.data['id'], data['id'])
        self.assertEqual(response.data['status'], PlanItemStatus.ACTIVE)
        self.assertEqual(Decimal(response.data['amount']), Decimal('250000.00'))
        self.assertEqual(response.data['department'], self.dept1.pk)
        self.assertEqual(response.data['economic_class'], self.econ.pk)

        old = DepartmentArticleLimit.objects.get(pk=data['id'])
        self.assertEqual(old.status, PlanItemStatus.ARCHIVE)
        self.assertIsNotNone(old.deactivated_at)
        self.assertEqual(old.amount, Decimal('200000.00'))

        self.assertEqual(
            DepartmentArticleLimit.objects.filter(
                department=self.dept1, economic_class=self.econ, status=PlanItemStatus.ACTIVE,
            ).count(),
            1,
        )

    def test_patch_amount_and_department_together_on_active_record_versions_with_both_changes(self):
        """Смешанный случай (решение пользователя 2026-11-26): сумма и подразделение меняются
        одновременно — версионируется целиком, новая ACTIVE-запись несёт ОБА новых значения,
        не разбивается на два отдельных шага."""
        from procurement.models import DepartmentArticleLimit

        data = self._create_draft(self.dept1, Decimal('200000.00'))
        self.client.post(f"/api/department_article_limits/{data['id']}/activate/")

        response = self.client.patch(
            f"/api/department_article_limits/{data['id']}/",
            {'amount': '300000.00', 'department': self.dept2.pk},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertNotEqual(response.data['id'], data['id'])
        self.assertEqual(response.data['status'], PlanItemStatus.ACTIVE)
        self.assertEqual(Decimal(response.data['amount']), Decimal('300000.00'))
        self.assertEqual(response.data['department'], self.dept2.pk)

        old = DepartmentArticleLimit.objects.get(pk=data['id'])
        self.assertEqual(old.status, PlanItemStatus.ARCHIVE)

    def test_patch_amount_change_colliding_with_other_active_combo_archives_both(self):
        """Смешанный случай, где новая связка (после смены подразделения) совпадает с уже
        существующей ДРУГОЙ ACTIVE-записью — та тоже должна архивироваться (unique-
        ограничение одна ACTIVE-запись на связку), а не привести к IntegrityError."""
        from procurement.models import DepartmentArticleLimit

        first = self._create_draft(self.dept1, Decimal('200000.00'))
        self.client.post(f"/api/department_article_limits/{first['id']}/activate/")
        second = self._create_draft(self.dept2, Decimal('100000.00'))
        self.client.post(f"/api/department_article_limits/{second['id']}/activate/")

        response = self.client.patch(
            f"/api/department_article_limits/{first['id']}/",
            {'amount': '250000.00', 'department': self.dept2.pk},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        new_id = response.data['id']

        self.assertEqual(
            DepartmentArticleLimit.objects.get(pk=first['id']).status, PlanItemStatus.ARCHIVE,
        )
        self.assertEqual(
            DepartmentArticleLimit.objects.get(pk=second['id']).status, PlanItemStatus.ARCHIVE,
        )
        new_record = DepartmentArticleLimit.objects.get(pk=new_id)
        self.assertEqual(new_record.status, PlanItemStatus.ACTIVE)
        self.assertEqual(new_record.department_id, self.dept2.pk)
        self.assertEqual(new_record.amount, Decimal('250000.00'))

    def test_patch_statya_colliding_with_other_active_record_rejected(self):
        """Правка БЕЗ смены суммы (на месте) не должна позволять создать дубль ACTIVE-связки —
        если после правки связка совпадает с уже существующей ACTIVE-записью другого
        держателя/статьи, сервер должен отклонить с понятной ошибкой, а не упасть 500."""
        first = self._create_draft(self.dept1, Decimal('200000.00'))
        self.client.post(f"/api/department_article_limits/{first['id']}/activate/")
        second = self._create_draft(self.dept2, Decimal('100000.00'))
        self.client.post(f"/api/department_article_limits/{second['id']}/activate/")

        response = self.client.patch(
            f"/api/department_article_limits/{second['id']}/",
            {'department': self.dept1.pk},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_patch_statya_and_amount_on_archive_record_rejected(self):
        """ARCHIVE — застывшая история, правится только note/deactivated_at, как и раньше.
        Запись архивируется ЧЕРЕЗ смену суммы (edit_active_limit), затем пробуем править уже
        архивную старую запись."""
        data = self._create_draft(self.dept1, Decimal('200000.00'))
        self.client.post(f"/api/department_article_limits/{data['id']}/activate/")
        # Смена суммы архивирует старую запись `data['id']` (создаёт новую ACTIVE отдельно).
        self.client.patch(
            f"/api/department_article_limits/{data['id']}/", {'amount': '250000.00'}, format='json',
        )

        response = self.client.patch(
            f"/api/department_article_limits/{data['id']}/", {'department': self.dept2.pk}, format='json',
        )
        self.assertEqual(response.status_code, 400)

        response = self.client.patch(
            f"/api/department_article_limits/{data['id']}/",
            {'note': 'архивная правка допустима'}, format='json',
        )
        self.assertEqual(response.status_code, 200)

    def test_delete_allowed_for_financier_on_any_status(self):
        """Решение пользователя (2026-11-26): финансист/админ могут удалять записи о
        лимитах — не только черновики, но и действующие/архивные."""
        from procurement.models import DepartmentArticleLimit

        draft = self._create_draft(self.dept1, Decimal('200000.00'))
        response = self.client.delete(f"/api/department_article_limits/{draft['id']}/")
        self.assertEqual(response.status_code, 204)

        active = self._create_draft(self.dept1, Decimal('200000.00'))
        self.client.post(f"/api/department_article_limits/{active['id']}/activate/")
        response = self.client.delete(f"/api/department_article_limits/{active['id']}/")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(DepartmentArticleLimit.objects.filter(pk=active['id']).exists())

        archived_source = self._create_draft(self.dept1, Decimal('150000.00'))
        self.client.post(f"/api/department_article_limits/{archived_source['id']}/activate/")
        promoted = self._create_draft(self.dept1, Decimal('175000.00'))
        self.client.post(f"/api/department_article_limits/{promoted['id']}/activate/")
        archived_now = DepartmentArticleLimit.objects.get(pk=archived_source['id'])
        self.assertEqual(archived_now.status, PlanItemStatus.ARCHIVE)
        response = self.client.delete(f"/api/department_article_limits/{archived_source['id']}/")
        self.assertEqual(response.status_code, 204)

    def test_overspend_does_not_block_activation(self):
        """Перерасход разрешён — только предупреждение на фронте, не блокировка (решение
        пользователя: "добавлять такую сумму разрешается")."""
        data = self._create_draft(self.dept1, Decimal('600000.00'))  # больше доступных 500000
        response = self.client.post(f"/api/department_article_limits/{data['id']}/activate/")
        self.assertEqual(response.status_code, 200)

    def test_article_availability_uses_both_prior_year_reserve_functions(self):
        """Починка техдолга (CurrentStatus.md, 2026-11-21: движок калибровки использовал
        только compute_reserved_amount_by_article, не вторую функцию) — теперь считает ОБЕ,
        как и `available_limit` в general_money_report.py."""
        supplier = Supplier.objects.create(name='Тестовый поставщик ДЛ-резерв')
        contract = Contract.objects.create(
            number='T-DL-RES', supplier=supplier, total_cost=Decimal('150000.00'),
            planned_delivery_date='2026-12-31',
        )
        purchases = Purchases.objects.create(year=2025)
        plan_item = PlanItem.objects.create(plan_purchase=purchases, num='2025-TEST-DL-RES', is_public=True)
        bc_2025 = BudgetCosts.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=1,
            cost=Decimal('150000.00'), year=2025,
            functional_class=self.func, economic_class=self.econ,
        )
        ps_2025 = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=bc_2025, department=self.dept1,
            shared_amount=Decimal('1'), shared_cost=Decimal('150000.00'),
        )
        ContractItem.objects.create(
            contract=contract, plan_share=ps_2025, year=2026,
            contract_amount=Decimal('1'), contract_cost=Decimal('150000.00'),
        )

        response = self.client.get('/api/department_article_limits/article_availability/', {
            'functional_class': self.func.pk, 'economic_class': self.econ.pk, 'year': 2026,
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Decimal(response.data['available_limit']), Decimal('350000.00'))  # 500000-150000
        self.assertEqual(Decimal(response.data['allocated_total']), Decimal('0'))
        self.assertEqual(Decimal(response.data['remaining']), Decimal('350000.00'))

    def test_overspend_summary_lists_statya_over_limit(self):
        data = self._create_draft(self.dept1, Decimal('600000.00'))  # больше доступных 500000
        self.client.post(f"/api/department_article_limits/{data['id']}/activate/")

        response = self.client.get('/api/department_article_limits/overspend_summary/', {'year': 2026})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        line = response.data[0]
        self.assertEqual(line['economic_class'], self.econ.pk)
        self.assertEqual(Decimal(line['overspend_amount']), Decimal('100000.00'))  # 600000-500000


class DepartmentLimitAvailabilityTestCase(TestCase):
    """compute_available_department_limit() — остаток лимита держателя за вычетом уже
    зарезервированного через PlanShare (решение пользователя 2026-11-03)."""

    def setUp(self):
        self.department = Department.objects.create(full_name='Тестовый отдел ДЛ', short_name='ТОДЛ')
        self.iec = InternalEconomicClassifier.objects.create(code='1100300099', name='Подстатья ДЛ')

    def test_available_reduced_by_plan_share(self):
        from procurement.models import FunctionalCode, ExternalEconomicCode, DepartmentArticleLimit
        func = FunctionalCode.objects.create(code_api='03 12 00 042', description='ГКСЭ-2')
        econ = ExternalEconomicCode.objects.create(code_api='1 10 03 98', description='Тест')
        department_limit = DepartmentArticleLimit.objects.create(
            functional_class=func, economic_class=econ, internal_economic_class=self.iec,
            department=self.department, year=2026, amount=Decimal('100000.00'),
        )

        purchases = Purchases.objects.create(year=2026)
        plan_item = PlanItem.objects.create(plan_purchase=purchases, num='2026-TEST-DL-1', is_public=True)
        budget_cost = BudgetCosts.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=1,
            cost=Decimal('40000.00'), year=2026, internal_economic_class=self.iec,
        )
        PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=budget_cost, department=self.department,
            shared_amount=Decimal('1'), shared_cost=Decimal('40000.00'),
        )

        available = department_limits_service.compute_available_department_limit(department_limit)
        self.assertEqual(available, Decimal('60000.00'))


class GeneralMoneyReportTestCase(TestCase):
    """Отчёт «Общие деньги» (решение пользователя 2026-11-03) — воспроизводит числовой
    пример пользователя (план 500000, резерв прошлых лет 150000, доведено 250000,
    нераспределено 100000) и проверяет остальные формулы на отдельных, контролируемых
    суммах (внесено в ГПЗ, принято обязательств, фактическая оплата)."""

    def setUp(self):
        from procurement.models import (
            FunctionalCode, ExternalEconomicCode, ArticleQuarterlyAllocation, DepartmentArticleLimit,
        )
        self.func = FunctionalCode.objects.create(code_api='03 12 00 039', description='ГКСЭ')
        self.econ = ExternalEconomicCode.objects.create(code_api='1 10 03 99', description='Расходные материалы')
        self.iec = InternalEconomicClassifier.objects.create(code='1100300003', name='Подстатья В')
        self.dept1 = Department.objects.create(full_name='Отдел ОД1', short_name='ОД1')
        self.dept2 = Department.objects.create(full_name='Отдел ОД2', short_name='ОД2')

        # Плановое назначение на год — 500000 (по 125000 на квартал).
        for q in [QuarterTypes.Q1, QuarterTypes.Q2, QuarterTypes.Q3, QuarterTypes.Q4]:
            ArticleQuarterlyAllocation.objects.create(
                functional_class=self.func, economic_class=self.econ, year=2026, quarter=q,
                amount=Decimal('125000.00'),
            )

        # Принятые обязательства прошлых лет — многолетний договор 2025 года, 150000 на 2026.
        supplier = Supplier.objects.create(name='Тестовый поставщик ОД')
        contract = Contract.objects.create(
            number='T-GM-1', supplier=supplier, total_cost=Decimal('150000.00'),
            planned_delivery_date='2026-12-31',
        )
        purchases_2025 = Purchases.objects.create(year=2025)
        plan_item_2025 = PlanItem.objects.create(plan_purchase=purchases_2025, num='2025-TEST-GM-1', is_public=True)
        bc_2025 = BudgetCosts.objects.create(
            plan_item=plan_item_2025, status=PlanItemStatus.ACTIVE, purchases_items_id=1,
            cost=Decimal('150000.00'), year=2025, functional_class=self.func, economic_class=self.econ,
        )
        ps_2025 = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=bc_2025, department=self.dept1,
            shared_amount=Decimal('1'), shared_cost=Decimal('150000.00'),
        )
        ContractItem.objects.create(
            contract=contract, plan_share=ps_2025, year=2026,
            contract_amount=Decimal('1'), contract_cost=Decimal('150000.00'),
        )

        # Доведённые лимиты — подстатья В, держатель dept1, 250000.
        DepartmentArticleLimit.objects.create(
            functional_class=self.func, economic_class=self.econ, internal_economic_class=self.iec,
            department=self.dept1, year=2026, amount=Decimal('250000.00'), status=PlanItemStatus.ACTIVE,
        )

        # Внесено в ГПЗ (2026 год, публикуемая + непубликуемая часть) — две позиции плана 2026.
        plan_item_pub = PlanItem.objects.create(plan_purchase=self._purchases_2026(), num='2026-TEST-GM-PUB', is_public=True)
        BudgetCosts.objects.create(
            plan_item=plan_item_pub, status=PlanItemStatus.ACTIVE, purchases_items_id=2,
            cost=Decimal('60000.00'), year=2026, functional_class=self.func, economic_class=self.econ,
            internal_economic_class=self.iec,
        )
        plan_item_nonpub = PlanItem.objects.create(plan_purchase=self._purchases_2026(), num='2026-TEST-GM-NONPUB', is_public=False)
        bc_nonpub = BudgetCosts.objects.create(
            plan_item=plan_item_nonpub, status=PlanItemStatus.ACTIVE, purchases_items_id=3,
            cost=Decimal('40000.00'), year=2026, functional_class=self.func, economic_class=self.econ,
            internal_economic_class=self.iec,
        )
        # Принято обязательств (текущего года) — договор на часть непубликуемой позиции.
        ps_nonpub = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=bc_nonpub, department=self.dept2,
            shared_amount=Decimal('1'), shared_cost=Decimal('40000.00'),
        )
        contract2 = Contract.objects.create(
            number='T-GM-2', supplier=supplier, total_cost=Decimal('30000.00'),
            planned_delivery_date='2026-12-31',
        )
        ContractItem.objects.create(
            contract=contract2, plan_share=ps_nonpub, year=2026,
            contract_amount=Decimal('1'), contract_cost=Decimal('30000.00'),
        )

        # Фактическая оплата — платёж, сопоставленный через internal_economic_class.
        kind = KindOfPayment.objects.create(name='Тестовый платёж ОД')
        TreasuryPayment.objects.create(
            amount=Decimal('20000.00'), kind=kind, internal_economic_class=self.iec,
            payment_year=2026, contract=contract2, program_class=None,
        )

    @staticmethod
    def _purchases_2026():
        from procurement.models import Purchases
        existing = Purchases.objects.filter(year=2026).first()
        return existing or Purchases.objects.create(year=2026)

    def test_report_row_matches_user_example_and_formulas(self):
        rows = compute_general_money_report(year=2026)
        self.assertEqual(len(rows), 1)
        row = rows[0]

        self.assertEqual(row['planned_annual'], Decimal('500000.00'))
        self.assertEqual(row['prior_years_obligations'], Decimal('150000.00'))
        # Доступные лимиты (2026-11-21): 500000 - 150000 = 350000.
        self.assertEqual(row['available_limit'], Decimal('350000.00'))
        self.assertEqual(row['allocated_limit'], Decimal('250000.00'))
        # Пример пользователя: 500000 - 150000 - 250000 = 100000.
        self.assertEqual(row['unassigned_limit'], Decimal('100000.00'))

        self.assertEqual(row['entered_into_plan'], Decimal('100000.00'))  # 60000 + 40000
        self.assertEqual(row['unallocated_limit'], Decimal('150000.00'))  # 250000 - 100000

        self.assertEqual(row['committed_obligations'], Decimal('30000.00'))
        self.assertEqual(row['remainder_unobligated'], Decimal('320000.00'))  # 500000-30000-150000

        self.assertEqual(row['paid_actual'], Decimal('20000.00'))
        self.assertEqual(row['remainder_with_actual'], Decimal('480000.00'))  # 500000-20000

    def test_free_payment_matched_by_direct_economic_class_without_internal_code(self):
        """Свободная платёжка без internal_economic_class, но с прямым economic_class —
        не должна быть потеряна (найдено на реальных данных: 3 из 17 таких платежей)."""
        kind = KindOfPayment.objects.create(name='Свободный платёж без внутр. кода')
        TreasuryPayment.objects.create(
            amount=Decimal('5000.00'), kind=kind, internal_economic_class=None,
            economic_class=self.econ, functional_class=self.func,
            payment_year=2026, contract=None, program_class=None,
        )
        rows = compute_general_money_report(year=2026)
        row = rows[0]
        self.assertEqual(row['paid_actual'], Decimal('25000.00'))  # 20000 + 5000

    def test_is_calibrated_true_even_when_allocated_limit_zero(self):
        """Запрос фронтенда (2026-11-20): allocated_limit == 0 — легитимный результат
        распределения (например, обнулили сумму держателя), не признак "распределение не
        проведено". is_calibrated должен различать эти два случая через сам факт
        существования ACTIVE записи, а не через сумму."""
        from procurement.models import DepartmentArticleLimit
        DepartmentArticleLimit.objects.filter(
            functional_class=self.func, economic_class=self.econ, year=2026, status=PlanItemStatus.ACTIVE,
        ).update(amount=Decimal('0'))

        rows = compute_general_money_report(year=2026)
        row = rows[0]
        self.assertEqual(row['allocated_limit'], Decimal('0'))
        self.assertTrue(row['is_calibrated'])

    def test_is_calibrated_false_when_no_subarticle_rows_at_all(self):
        from procurement.models import (
            ArticleQuarterlyAllocation, DepartmentArticleLimit, FunctionalCode, ExternalEconomicCode,
        )
        DepartmentArticleLimit.objects.all().delete()
        func2 = FunctionalCode.objects.create(code_api='03 12 00 040', description='Другая ГКСЭ-статья')
        econ2 = ExternalEconomicCode.objects.create(code_api='1 10 03 98', description='Без калибровки')
        for q in [QuarterTypes.Q1, QuarterTypes.Q2, QuarterTypes.Q3, QuarterTypes.Q4]:
            ArticleQuarterlyAllocation.objects.create(
                functional_class=func2, economic_class=econ2, year=2026, quarter=q, amount=Decimal('1000.00'),
            )

        rows = compute_general_money_report(year=2026)
        row = next(r for r in rows if r['economic_class_id'] == econ2.pk)
        self.assertEqual(row['allocated_limit'], Decimal('0'))
        self.assertFalse(row['is_calibrated'])

    def test_rows_sorted_by_economic_code_numeric_segments_not_lexicographically(self):
        """Запрос фронтенда (2026-11-20): без сортировки фронту приходилось пересчитывать
        порядок на клиенте, чтобы сгруппировать строки по статье (первые два сегмента
        economic_code). Код "1 2 ..." лексикографически МЕНЬШЕ "1 10 ...", хотя по смыслу
        сегмента (2 < 10) порядок должен быть обратным — проверяем именно эту ловушку."""
        from procurement.models import ArticleQuarterlyAllocation, ExternalEconomicCode
        econ_small_lexically_first = ExternalEconomicCode.objects.create(
            code_api='1 10 00 00', description='Сегмент "10"',
        )
        econ_big_lexically_first = ExternalEconomicCode.objects.create(
            code_api='1 2 00 00', description='Сегмент "2"',
        )
        for econ in (econ_small_lexically_first, econ_big_lexically_first):
            ArticleQuarterlyAllocation.objects.create(
                functional_class=self.func, economic_class=econ, year=2026,
                quarter=QuarterTypes.Q1, amount=Decimal('1.00'),
            )

        rows = compute_general_money_report(year=2026)
        codes_in_order = [r['economic_code'] for r in rows]
        self.assertLess(
            codes_in_order.index('1 2 00 00'), codes_in_order.index('1 10 00 00'),
        )

    def test_same_economic_code_different_paragraph_distinguished_by_functional_description(self):
        """Запрос пользователя (2026-11-21): один и тот же economic_code может встречаться
        НЕСКОЛЬКИМИ строками отчёта с разными суммами, если финансирование идёт по разным
        параграфам (пример пользователя: "2 40 01 00" дважды на реальных данных) — фронту
        нужен текст параграфа (functional_description), иначе не различить, какая строка
        к какому параграфу относится."""
        from procurement.models import ArticleQuarterlyAllocation, FunctionalCode
        func2 = FunctionalCode.objects.create(
            code_api='03 12 00 042', description='03_12_00 § 851 (Витебск 3)',
        )
        ArticleQuarterlyAllocation.objects.create(
            functional_class=func2, economic_class=self.econ, year=2026,
            quarter=QuarterTypes.Q1, amount=Decimal('1000.00'),
        )

        rows = compute_general_money_report(year=2026)
        matching = [r for r in rows if r['economic_code'] == self.econ.code_api]
        self.assertEqual(len(matching), 2)
        functional_descriptions = {r['functional_description'] for r in matching}
        self.assertEqual(functional_descriptions, {self.func.description, func2.description})


class GeneralMoneyReportPriorYearsPlanBudgetTestCase(TestCase):
    """Запрос пользователя (2026-11-21): "принятые обязательства прошлых лет" должны
    учитывать не только резерв через рассинхрон ContractItem.year/budget_cost.year (уже
    покрыто GeneralMoneyReportTestCase), но и позиции, ОПУБЛИКОВАННЫЕ В ПРЕДЫДУЩЕМ плане,
    но уже имеющие собственную строку BudgetCosts ИМЕННО года отчёта (пример пользователя:
    позиция 2026-102377498-117 — план 2026 года, финансирование в 2026 и 2027 — при отчёте
    за 2027 год сумма 2027 года должна попасть в prior_years_obligations, хотя позиции в
    плане 2027 года нет вообще)."""

    def setUp(self):
        from procurement.models import FunctionalCode, ExternalEconomicCode, ArticleQuarterlyAllocation
        self.func = FunctionalCode.objects.create(code_api='03 12 00 777', description='ГКСЭ-МЛ')
        self.econ = ExternalEconomicCode.objects.create(code_api='1 10 03 77', description='Тест многолетка')

        # Плановое назначение на 2027 год (отдельный план/файл fin_2027, уже загружен) —
        # 250000 итого (по 62500 на квартал).
        for q in [QuarterTypes.Q1, QuarterTypes.Q2, QuarterTypes.Q3, QuarterTypes.Q4]:
            ArticleQuarterlyAllocation.objects.create(
                functional_class=self.func, economic_class=self.econ, year=2027, quarter=q,
                amount=Decimal('62500.00'),
            )

        # Позиция опубликована в плане 2026 года (plan_purchase.year=2026), но финансируется
        # ДВУМЯ отдельными строками BudgetCosts — 2026 и 2027. Самой позиции в плане 2027
        # года нет (никакого PlanItem с plan_purchase.year=2027 не создаём).
        purchases_2026 = Purchases.objects.create(year=2026)
        self.plan_item = PlanItem.objects.create(
            plan_purchase=purchases_2026, num='2026-TEST-ML-117', is_public=True,
        )
        BudgetCosts.objects.create(
            plan_item=self.plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=1,
            cost=Decimal('400000.00'), year=2026, functional_class=self.func, economic_class=self.econ,
        )
        self.bc_2027 = BudgetCosts.objects.create(
            plan_item=self.plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=2,
            cost=Decimal('300000.00'), year=2027, functional_class=self.func, economic_class=self.econ,
        )

    def test_prior_years_obligations_includes_future_year_budget_cost_of_older_plan_item(self):
        rows = compute_general_money_report(year=2027)
        self.assertEqual(len(rows), 1)
        row = rows[0]
        self.assertEqual(row['planned_annual'], Decimal('250000.00'))
        self.assertEqual(row['prior_years_obligations'], Decimal('300000.00'))
        # 250000 - 300000 = -50000 — отчёт не должен "прятать" перерасход отрицательным
        # занулением, финансист должен увидеть реальное превышение.
        self.assertEqual(row['available_limit'], Decimal('-50000.00'))

    def test_own_year_plan_item_budget_cost_is_not_counted_as_prior_years(self):
        """Контрольный случай: BudgetCosts(year=2027) позиции, ОПУБЛИКОВАННОЙ В ПЛАНЕ 2027
        года (а не прошлого) — не должна попадать в prior_years_obligations, это обычное
        "внесено в ГПЗ" текущего года отчёта."""
        purchases_2027 = Purchases.objects.create(year=2027)
        own_year_item = PlanItem.objects.create(
            plan_purchase=purchases_2027, num='2027-TEST-ML-OWN', is_public=True,
        )
        BudgetCosts.objects.create(
            plan_item=own_year_item, status=PlanItemStatus.ACTIVE, purchases_items_id=3,
            cost=Decimal('10000.00'), year=2027, functional_class=self.func, economic_class=self.econ,
        )
        rows = compute_general_money_report(year=2027)
        row = rows[0]
        # prior_years_obligations не меняется — только сумма от позиции 2026 года.
        self.assertEqual(row['prior_years_obligations'], Decimal('300000.00'))
        # А "внесено в ГПЗ" теперь включает обе строки (300000 + 10000).
        self.assertEqual(row['entered_into_plan'], Decimal('310000.00'))

    def test_does_not_double_count_with_contract_item_reservation_mechanism(self):
        """Оба механизма резерва (ContractItem-рассинхрон и BudgetCosts предыдущего плана)
        не пересекаются — суммируются, не задваивая одну и ту же сумму."""
        supplier = Supplier.objects.create(name='Тестовый поставщик ML')
        department = Department.objects.create(full_name='Отдел ML', short_name='МЛ')
        plan_share = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=self.bc_2027, department=department,
            shared_amount=Decimal('1'), shared_cost=Decimal('300000.00'),
        )
        # Отдельный многолетний договор другой позиции (2026 года), резервирующий ещё
        # 50000 на 2027 год через рассинхрон ContractItem.year/budget_cost.year.
        purchases_2026b = Purchases.objects.create(year=2026)
        other_item = PlanItem.objects.create(
            plan_purchase=purchases_2026b, num='2026-TEST-ML-OTHER', is_public=True,
        )
        bc_other_2026 = BudgetCosts.objects.create(
            plan_item=other_item, status=PlanItemStatus.ACTIVE, purchases_items_id=4,
            cost=Decimal('50000.00'), year=2026, functional_class=self.func, economic_class=self.econ,
        )
        ps_other = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=bc_other_2026, department=department,
            shared_amount=Decimal('1'), shared_cost=Decimal('50000.00'),
        )
        contract = Contract.objects.create(
            number='T-ML-OTHER', supplier=supplier, total_cost=Decimal('50000.00'),
            planned_delivery_date='2027-12-31',
        )
        ContractItem.objects.create(
            contract=contract, plan_share=ps_other, year=2027,
            contract_amount=Decimal('1'), contract_cost=Decimal('50000.00'),
        )

        rows = compute_general_money_report(year=2027)
        row = rows[0]
        self.assertEqual(row['prior_years_obligations'], Decimal('350000.00'))  # 300000 + 50000


class PlanItemCodeFilterTestCase(TestCase):
    """Серверная фильтрация /api/plan_items/ по functional_code/economic_code/
    internal_economic_code (запрошено фронтендом 2026-11-06, см. CurrentStatus.md Этап 4.5) —
    раньше эти query-параметры молча игнорировались, фронт был вынужден грузить весь
    реестр года и фильтровать на клиенте."""

    def setUp(self):
        from procurement.models import FunctionalCode, ExternalEconomicCode

        self.purchases = Purchases.objects.create(year=2026)
        self.iec_a = InternalEconomicClassifier.objects.create(code='1101008173', name='Статья А')
        self.iec_b = InternalEconomicClassifier.objects.create(code='1101008999', name='Статья Б')
        # 2026-11-26: фильтр переведён на FK (functional_class__code_api/economic_class__
        # code_api) — см. CurrentStatus.md, баг "2026-INTERNAL-..." — поэтому фикстуры
        # теперь заполняют И денормализованную строку (как раньше), И связанный FK (как при
        # реальной синхронизации через BudgetCostsImportSerializer.validate(), который
        # всегда выставляет оба поля вместе — отдельный тест на случай "FK есть, строки
        # нет" см. PlanItemCodeFilterMatchesInternalItemsTestCase).
        self.func_039 = FunctionalCode.objects.create(code_api='03 12 00 039', description='Параграф 039')
        self.func_042 = FunctionalCode.objects.create(code_api='03 12 00 042', description='Параграф 042')
        self.econ_1 = ExternalEconomicCode.objects.create(code_api='1 10 10 99', description='Статья 1 10 10 99')
        self.econ_2 = ExternalEconomicCode.objects.create(code_api='2 40 01 00', description='Статья 2 40 01 00')

        self.item_a = PlanItem.objects.create(plan_purchase=self.purchases, num='2026-TEST-F-1', is_public=True)
        PlanItemDetail.objects.create(
            plan_item=self.item_a, status=PlanItemStatus.ACTIVE, num='2026-TEST-F-1',
            title='Позиция A', okrb='00.00.00.000', val_amount=Decimal('1'),
        )
        BudgetCosts.objects.create(
            plan_item=self.item_a, status=PlanItemStatus.ACTIVE, purchases_items_id=101,
            cost=Decimal('1000.00'), year=2026, functional_code='03 12 00 039',
            functional_class=self.func_039, economic_code='1 10 10 99', economic_class=self.econ_1,
            internal_economic_class=self.iec_a,
        )

        self.item_b = PlanItem.objects.create(plan_purchase=self.purchases, num='2026-TEST-F-2', is_public=True)
        PlanItemDetail.objects.create(
            plan_item=self.item_b, status=PlanItemStatus.ACTIVE, num='2026-TEST-F-2',
            title='Позиция Б', okrb='00.00.00.000', val_amount=Decimal('1'),
        )
        BudgetCosts.objects.create(
            plan_item=self.item_b, status=PlanItemStatus.ACTIVE, purchases_items_id=102,
            cost=Decimal('2000.00'), year=2026, functional_code='03 12 00 042',
            functional_class=self.func_042, economic_code='2 40 01 00', economic_class=self.econ_2,
            internal_economic_class=self.iec_b,
        )

        # Вторая, уже архивная строка бюджета позиции A с ДРУГИМ кодом — не должна попадать
        # в фильтр (проверяет, что фильтр учитывает только ACTIVE, как и остальной API).
        BudgetCosts.objects.create(
            plan_item=self.item_a, status=PlanItemStatus.ARCHIVE, purchases_items_id=101,
            cost=Decimal('900.00'), year=2025, functional_code='03 12 00 042',
            functional_class=self.func_042, economic_code='2 40 01 00', economic_class=self.econ_2,
            internal_economic_class=self.iec_b,
        )

    def _ids(self, **query):
        query.setdefault('purchase', self.purchases.id)
        response = self.client.get('/api/plan_items/', query)
        self.assertEqual(response.status_code, 200)
        return {row['id'] for row in response.json()['results']}

    def test_filter_by_functional_code(self):
        self.assertEqual(self._ids(functional_code='03 12 00 039'), {self.item_a.id})

    def test_filter_by_economic_code(self):
        self.assertEqual(self._ids(economic_code='2 40 01 00'), {self.item_b.id})

    def test_filter_by_internal_economic_code(self):
        self.assertEqual(self._ids(internal_economic_code='1101008173'), {self.item_a.id})

    def test_no_filter_returns_both(self):
        self.assertEqual(self._ids(), {self.item_a.id, self.item_b.id})

    def test_filter_does_not_match_against_archived_budget_cost(self):
        # Архивная строка позиции A имеет functional_code='03 12 00 042' (как у B),
        # но находится в статусе ARCHIVE — не должна давать A в выдаче по этому коду.
        self.assertEqual(self._ids(functional_code='03 12 00 042'), {self.item_b.id})

    def test_combined_filters_do_not_duplicate_rows(self):
        ids = self._ids(functional_code='03 12 00 039', economic_code='1 10 10 99')
        self.assertEqual(ids, {self.item_a.id})


class PlanItemInternalBudgetCostDisplayAndFilterTestCase(TestCase):
    """Баг пользователя (2026-11-26): позиции вида "2026-INTERNAL-00001" (строки реестра,
    созданные `import_reestr26.py::create_budget_cost_for_item()`, минуя синхронизацию с
    goszakupki.by) показывали прочерк в колонках "Функциональный код"/"Экономический код"
    реестра закупок, хотя на карточке позиции (`/plan-items/<id>`) те же данные были видны.
    Причина — такие строки `BudgetCosts` заполняют каноническую FK (`functional_class`/
    `economic_class`), но НЕ денормализованную строку "как с портала" (`functional_code`/
    `economic_code` — её заполняет только `BudgetCostsImportSerializer`, см. docstring
    `BudgetCostsForShortItemSerializer`). Этот тест воспроизводит именно такую строку (FK
    есть, строка — NULL) и проверяет и отображение, и фильтр по коду."""

    def setUp(self):
        from procurement.models import FunctionalCode, ExternalEconomicCode

        self.purchases = Purchases.objects.create(year=2026)
        self.func = FunctionalCode.objects.create(code_api='03 12 00 039', description='Параграф 039')
        self.econ = ExternalEconomicCode.objects.create(code_api='1 10 10 99', description='Статья 1 10 10 99')

        self.item = PlanItem.objects.create(plan_purchase=self.purchases, num='2026-INTERNAL-00001', is_public=False)
        PlanItemDetail.objects.create(
            plan_item=self.item, status=PlanItemStatus.ACTIVE, num='2026-INTERNAL-00001',
            title='Внутренняя позиция', okrb='00.00.00.000', val_amount=Decimal('1'),
        )
        # Ключевая деталь воспроизведения: functional_code/economic_code (строки) — NOT SET
        # (остаются NULL по умолчанию модели), только FK.
        self.budget_cost = BudgetCosts.objects.create(
            plan_item=self.item, status=PlanItemStatus.ACTIVE, purchases_items_id=0,
            cost=Decimal('138000.00'), year=2026,
            functional_class=self.func, economic_class=self.econ,
        )

    def test_registry_list_shows_codes_via_fk_fallback(self):
        response = self.client.get('/api/plan_items/', {'purchase': self.purchases.id})
        self.assertEqual(response.status_code, 200)
        row = next(r for r in response.json()['results'] if r['id'] == self.item.id)
        self.assertEqual(len(row['economic_details']), 1)
        detail = row['economic_details'][0]
        self.assertEqual(detail['functional_code'], '03 12 00 039')
        self.assertEqual(detail['economic_code'], '1 10 10 99')

    def test_filter_by_functional_code_matches_fk_only_record(self):
        response = self.client.get(
            '/api/plan_items/', {'purchase': self.purchases.id, 'functional_code': '03 12 00 039'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual({r['id'] for r in response.json()['results']}, {self.item.id})

    def test_filter_by_economic_code_matches_fk_only_record(self):
        response = self.client.get(
            '/api/plan_items/', {'purchase': self.purchases.id, 'economic_code': '1 10 10 99'},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual({r['id'] for r in response.json()['results']}, {self.item.id})


class PlanItemPlanSharesUnsetFilterTestCase(TestCase):
    """Запрос пользователя (2026-11-26): фильтр реестра закупок "Сведения о финансировании
    подразделений не добавлены" — позиции, у которых есть активное финансирование
    (`BudgetCosts`), но ни у одной его строки нет ни одной активной `PlanShare`."""

    def setUp(self):
        self.purchases = Purchases.objects.create(year=2026)
        self.dept = Department.objects.create(full_name='Управление 1', short_name='У1')

        # Позиция A: финансирование есть, распределения по подразделениям НЕТ.
        self.item_a = PlanItem.objects.create(plan_purchase=self.purchases, num='2026-TEST-PS-1', is_public=True)
        PlanItemDetail.objects.create(
            plan_item=self.item_a, status=PlanItemStatus.ACTIVE, num='2026-TEST-PS-1',
            title='Позиция A', okrb='00.00.00.000', val_amount=Decimal('1'),
        )
        BudgetCosts.objects.create(
            plan_item=self.item_a, status=PlanItemStatus.ACTIVE, purchases_items_id=301,
            cost=Decimal('100.00'), year=2026,
        )

        # Позиция B: финансирование есть И распределено (хотя бы одна активная PlanShare).
        self.item_b = PlanItem.objects.create(plan_purchase=self.purchases, num='2026-TEST-PS-2', is_public=True)
        PlanItemDetail.objects.create(
            plan_item=self.item_b, status=PlanItemStatus.ACTIVE, num='2026-TEST-PS-2',
            title='Позиция Б', okrb='00.00.00.000', val_amount=Decimal('1'),
        )
        bc_b = BudgetCosts.objects.create(
            plan_item=self.item_b, status=PlanItemStatus.ACTIVE, purchases_items_id=302,
            cost=Decimal('200.00'), year=2026,
        )
        PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=bc_b, department=self.dept,
            shared_amount=Decimal('1'), shared_cost=Decimal('200.00'),
        )

        # Позиция C: у позиции ВООБЩЕ нет активного финансирования — не должна считаться
        # "распределение не добавлено" (нет самих "Сведения о финансировании", о которых
        # идёт речь в запросе пользователя).
        self.item_c = PlanItem.objects.create(plan_purchase=self.purchases, num='2026-TEST-PS-3', is_public=True)
        PlanItemDetail.objects.create(
            plan_item=self.item_c, status=PlanItemStatus.ACTIVE, num='2026-TEST-PS-3',
            title='Позиция В', okrb='00.00.00.000', val_amount=Decimal('1'),
        )

        # Позиция D: ЕСТЬ активное финансирование, но PlanShare у него только АРХИВНАЯ —
        # должна считаться "не распределено" (архивная доля — не действующее распределение).
        self.item_d = PlanItem.objects.create(plan_purchase=self.purchases, num='2026-TEST-PS-4', is_public=True)
        PlanItemDetail.objects.create(
            plan_item=self.item_d, status=PlanItemStatus.ACTIVE, num='2026-TEST-PS-4',
            title='Позиция Г', okrb='00.00.00.000', val_amount=Decimal('1'),
        )
        bc_d = BudgetCosts.objects.create(
            plan_item=self.item_d, status=PlanItemStatus.ACTIVE, purchases_items_id=304,
            cost=Decimal('400.00'), year=2026,
        )
        PlanShare.objects.create(
            status=PlanItemStatus.ARCHIVE, budget_cost=bc_d, department=self.dept,
            shared_amount=Decimal('1'), shared_cost=Decimal('400.00'),
        )

    def _ids(self, **query):
        query.setdefault('purchase', self.purchases.id)
        response = self.client.get('/api/plan_items/', query)
        self.assertEqual(response.status_code, 200)
        return {row['id'] for row in response.json()['results']}

    def test_plan_shares_unset_filters_to_items_without_any_active_share(self):
        self.assertEqual(self._ids(plan_shares_unset='true'), {self.item_a.id, self.item_d.id})

    def test_plan_shares_unset_excludes_item_with_active_share(self):
        ids = self._ids(plan_shares_unset='true')
        self.assertNotIn(self.item_b.id, ids)

    def test_plan_shares_unset_excludes_item_without_any_financing_at_all(self):
        # У C вообще нет BudgetCosts — не то же самое, что "финансирование есть, но без
        # распределения по подразделениям".
        ids = self._ids(plan_shares_unset='true')
        self.assertNotIn(self.item_c.id, ids)

    def test_without_filter_returns_all_four(self):
        self.assertEqual(
            self._ids(), {self.item_a.id, self.item_b.id, self.item_c.id, self.item_d.id},
        )


class PlanItemBuyerDepartmentFilterTestCase(TestCase):
    """Серверная фильтрация /api/plan_items/ по ?buyer=<id> и ?department=<id>
    (запрошено фронтендом 2026-11-21, см. CurrentStatus.md): select с конкретным
    исполнителем (дополняет уже существующий ?buyer_unset=true) и select с
    подразделением, для которого проводится закупка (через PlanShare)."""

    def setUp(self):
        self.purchases = Purchases.objects.create(year=2026)
        self.buyer_a = Buyer.objects.create(shot_name='Иванов И.И.', full_name='Иванов Иван Иванович')
        self.buyer_b = Buyer.objects.create(shot_name='Петров П.П.', full_name='Петров Пётр Петрович')
        self.dept_1 = Department.objects.create(full_name='Управление 1', short_name='У1')
        self.dept_2 = Department.objects.create(full_name='Управление 2', short_name='У2')

        # Позиция A: закупщик — buyer_a, распределена только на dept_1.
        self.item_a = PlanItem.objects.create(plan_purchase=self.purchases, num='2026-TEST-BD-1', is_public=True)
        PlanItemDetail.objects.create(
            plan_item=self.item_a, status=PlanItemStatus.ACTIVE, num='2026-TEST-BD-1',
            title='Позиция A', okrb='00.00.00.000', val_amount=Decimal('1'), buyer=self.buyer_a,
        )
        bc_a = BudgetCosts.objects.create(
            plan_item=self.item_a, status=PlanItemStatus.ACTIVE, purchases_items_id=201,
            cost=Decimal('100.00'), year=2026,
        )
        PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=bc_a, department=self.dept_1,
            shared_amount=Decimal('1'), shared_cost=Decimal('100.00'),
        )

        # Позиция B: закупщик — buyer_b, распределена на dept_1 И dept_2 (две строки
        # PlanShare под одной BudgetCosts) — должна находиться фильтром по ЛЮБОМУ из них.
        self.item_b = PlanItem.objects.create(plan_purchase=self.purchases, num='2026-TEST-BD-2', is_public=True)
        PlanItemDetail.objects.create(
            plan_item=self.item_b, status=PlanItemStatus.ACTIVE, num='2026-TEST-BD-2',
            title='Позиция Б', okrb='00.00.00.000', val_amount=Decimal('2'), buyer=self.buyer_b,
        )
        bc_b = BudgetCosts.objects.create(
            plan_item=self.item_b, status=PlanItemStatus.ACTIVE, purchases_items_id=202,
            cost=Decimal('200.00'), year=2026,
        )
        PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=bc_b, department=self.dept_1,
            shared_amount=Decimal('1'), shared_cost=Decimal('100.00'),
        )
        PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=bc_b, department=self.dept_2,
            shared_amount=Decimal('1'), shared_cost=Decimal('100.00'),
        )

        # Позиция C: закупщик не указан, распределена на dept_2 — проверяет, что фильтр
        # по buyer не путает "не указан" с конкретным id, и что department=dept_2 находит
        # и B, и C без дублей.
        self.item_c = PlanItem.objects.create(plan_purchase=self.purchases, num='2026-TEST-BD-3', is_public=True)
        PlanItemDetail.objects.create(
            plan_item=self.item_c, status=PlanItemStatus.ACTIVE, num='2026-TEST-BD-3',
            title='Позиция В', okrb='00.00.00.000', val_amount=Decimal('1'),
        )
        bc_c = BudgetCosts.objects.create(
            plan_item=self.item_c, status=PlanItemStatus.ACTIVE, purchases_items_id=203,
            cost=Decimal('50.00'), year=2026,
        )
        PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=bc_c, department=self.dept_2,
            shared_amount=Decimal('1'), shared_cost=Decimal('50.00'),
        )

    def _ids(self, **query):
        query.setdefault('purchase', self.purchases.id)
        response = self.client.get('/api/plan_items/', query)
        self.assertEqual(response.status_code, 200)
        return {row['id'] for row in response.json()['results']}

    def test_filter_by_buyer(self):
        self.assertEqual(self._ids(buyer=self.buyer_a.id), {self.item_a.id})
        self.assertEqual(self._ids(buyer=self.buyer_b.id), {self.item_b.id})

    def test_filter_by_department_does_not_duplicate_rows(self):
        # item_b имеет ДВЕ строки PlanShare на dept_1/dept_2 под одной BudgetCosts —
        # distinct() должен вернуть её один раз, а не дважды.
        self.assertEqual(self._ids(department=self.dept_1.id), {self.item_a.id, self.item_b.id})
        self.assertEqual(self._ids(department=self.dept_2.id), {self.item_b.id, self.item_c.id})

    def test_combined_buyer_and_department_filters(self):
        self.assertEqual(
            self._ids(buyer=self.buyer_b.id, department=self.dept_2.id), {self.item_b.id},
        )


class PlanItemListQueryCountTestCase(TestCase):
    """Регрессионный тест на N+1 в `/api/plan_items/` (найдено и исправлено 2026-11-06,
    жалоба фронтенда на медленные ответы — см. CurrentStatus.md Этап 4.6):
    `PlanItemShortSerializer.get_economic_details()`/`get_contracts()` и
    `BudgetCostsForShortItemSerializer.get_full_cost()` переспрашивали БД на каждую
    позицию плана и на каждую её строку бюджета вместо уже готового префетча/аннотации.
    Доказываем количество SQL-запросов на страницу НЕ растёт с числом позиций/строк
    бюджета — O(1) от размера страницы, а не O(N)."""

    def _build_plan_items(self, count):
        purchases = Purchases.objects.create(year=2027)
        iec = InternalEconomicClassifier.objects.create(code=f'99{count}0000000', name='Тестовая статья')
        supplier = Supplier.objects.create(name=f'Тестовый поставщик N+1 ({count})')
        department = Department.objects.create(full_name=f'Отдел N+1 ({count})', short_name=f'НQ{count}')
        for i in range(count):
            item = PlanItem.objects.create(plan_purchase=purchases, num=f'2027-TEST-NQ-{count}-{i}', is_public=True)
            PlanItemDetail.objects.create(
                plan_item=item, status=PlanItemStatus.ACTIVE, num=item.num,
                title=f'Позиция {i}', okrb='00.00.00.000', val_amount=Decimal('2'),
            )
            # 2 строки бюджета на позицию (val_amount=2 выше — по 1 единице на строку,
            # иначе PlanShare.save() упал бы на превышении количества по позиции) — именно
            # множественность budget_costs на одну позицию раньше умножала число лишних
            # запросов внутри списка.
            for j in range(2):
                bc = BudgetCosts.objects.create(
                    plan_item=item, status=PlanItemStatus.ACTIVE, purchases_items_id=1000 * i + j,
                    cost=Decimal('100.00'), year=2027, internal_economic_class=iec,
                )
                ps = PlanShare.objects.create(
                    status=PlanItemStatus.ACTIVE, budget_cost=bc, department=department,
                    shared_amount=Decimal('1'), shared_cost=Decimal('100.00'),
                )
                if j == 0:
                    contract = Contract.objects.create(
                        number=f'T-NQ-{count}-{i}-{j}', supplier=supplier, total_cost=Decimal('100.00'),
                        planned_delivery_date='2027-12-31',
                    )
                    ContractItem.objects.create(
                        contract=contract, plan_share=ps, year=2027,
                        contract_amount=Decimal('1'), contract_cost=Decimal('100.00'),
                    )
        return purchases

    def test_query_count_does_not_scale_with_row_count(self):
        purchases_small = self._build_plan_items(2)
        purchases_large = self._build_plan_items(8)

        with CaptureQueriesContext(connection) as small:
            response_small = self.client.get('/api/plan_items/', {'purchase': purchases_small.id, 'limit': 50})
        self.assertEqual(response_small.status_code, 200)
        self.assertEqual(response_small.json()['count'], 2)

        with CaptureQueriesContext(connection) as large:
            response_large = self.client.get('/api/plan_items/', {'purchase': purchases_large.id, 'limit': 50})
        self.assertEqual(response_large.status_code, 200)
        self.assertEqual(response_large.json()['count'], 8)

        # Главная проверка: 4х больше позиций (и, соответственно, строк бюджета/договоров)
        # не должно давать 4х больше запросов — число запросов на страницу константно.
        self.assertEqual(
            len(small.captured_queries), len(large.captured_queries),
            msg=f"Число SQL-запросов растёт с размером страницы (N+1): "
                f"{len(small.captured_queries)} для 2 позиций vs {len(large.captured_queries)} для 8 — "
                f"запросы:\n" + "\n".join(q['sql'][:200] for q in large.captured_queries),
        )

        # Заодно проверяем сами данные корректны после рефакторинга: has_contracts
        # через annotate совпадает с бизнес-смыслом (j==0 строка бюджета — с договором).
        item = next(r for r in response_large.json()['results'] if r['num'].endswith('-0'))
        self.assertTrue(item['contracts'])


class CodeNormalizationTestCase(TestCase):
    """Нормализация кодов goszakupki.by (найдено 2026-11-06 — жалоба фронтенда на
    дублирующиеся коды в справочниках, пример пользователя "1 10 01 05" vs "1 10 1 5",
    см. CurrentStatus.md Этап 4.6). Проверяем саму функцию и то, что сериализатор импорта
    через неё реально сопоставляет "сжатый" код с уже существующим каноническим объектом
    справочника, а не плодит дубль."""

    def test_normalize_functional_code(self):
        self.assertEqual(normalize_functional_code('3 12 0 39'), '03 12 00 039')
        self.assertEqual(normalize_functional_code('03 12 00 039'), '03 12 00 039')  # уже канонический — не трогаем
        self.assertEqual(normalize_functional_code('3 12 0 852'), '03 12 00 852')  # новый код без канонической пары

    def test_normalize_economic_code(self):
        # Ровно пример пользователя из постановки задачи.
        self.assertEqual(normalize_economic_code('1 10 1 5'), '1 10 01 05')
        self.assertEqual(normalize_economic_code('1 10 01 05'), '1 10 01 05')
        self.assertEqual(normalize_economic_code('2 40 1 0'), '2 40 01 00')

    def test_normalize_program_code(self):
        self.assertEqual(normalize_program_code('99 0'), '099 00')
        self.assertEqual(normalize_program_code('099 00'), '099 00')

    def test_normalize_unexpected_shape_returns_as_is(self):
        # Неожиданное число групп — не выдумываем структуру, возвращаем как есть
        # (несовпадение проявится как несопоставленный код в отчёте, не как искажение).
        self.assertEqual(normalize_functional_code('03 12 00'), '03 12 00')
        self.assertEqual(normalize_functional_code(''), '')
        self.assertEqual(normalize_functional_code(None), None)

    def test_import_serializer_maps_compact_code_to_existing_canonical_reference(self):
        """Интеграционный сценарий: в справочнике уже есть канонический FunctionalCode/
        ExternalEconomicCode, а goszakupki.by в этот раз присылает тот же код в сжатом виде —
        сериализатор импорта не должен создавать второй (дублирующий) объект справочника."""
        from procurement.models import FunctionalCode, ExternalEconomicCode

        canonical_func = FunctionalCode.objects.create(code_api='03 12 00 039', description='§039')
        canonical_econ = ExternalEconomicCode.objects.create(code_api='1 10 01 05', description='Статья 1.10.01.05')
        purchases = Purchases.objects.create(year=2027)
        plan_item = PlanItem.objects.create(plan_purchase=purchases, num='2027-TEST-NORM-1', is_public=True)

        # Форма payload — как реально строит procurement/services/goszakupki_sync.py из
        # ответа API (все поля присутствуют, даже если значение null) — не минимальный
        # произвольный dict, иначе можно случайно не покрыть реальный путь данных.
        serializer = BudgetCostsImportSerializer(data={
            'plan_item': plan_item.id, 'purchases_items_id': 999,
            'functional_code': '3 12 0 39', 'economic_code': '1 10 1 5',
            'department_code': '', 'program_code': '', 'budget_code_name': 'Тестовый бюджет', 'unk': '',
        })
        serializer.is_valid(raise_exception=True)
        bc = serializer.save()

        self.assertEqual(bc.functional_code, '03 12 00 039')
        self.assertEqual(bc.economic_code, '1 10 01 05')
        self.assertEqual(bc.functional_class_id, canonical_func.id)
        self.assertEqual(bc.economic_class_id, canonical_econ.id)
        # Главное: не появилось НИКАКОГО нового объекта справочника под сжатую форму.
        self.assertEqual(FunctionalCode.objects.count(), 1)
        self.assertEqual(ExternalEconomicCode.objects.count(), 1)

    def test_import_serializer_tolerates_missing_optional_keys(self):
        """Попутно найденный баг (не падал на реальной синхронизации только потому, что там
        словарь всегда полный) — `to_internal_value` падал KeyError, если ключ физически
        отсутствовал в payload (не null, а именно отсутствовал). Теперь — не падает."""
        purchases = Purchases.objects.create(year=2027)
        plan_item = PlanItem.objects.create(plan_purchase=purchases, num='2027-TEST-NORM-2', is_public=True)

        serializer = BudgetCostsImportSerializer(data={
            'plan_item': plan_item.id, 'purchases_items_id': 998,
            'functional_code': '03 12 00 039',
            # department_code/economic_code/program_code/budget_code_name/unk отсутствуют вовсе
        })
        serializer.is_valid(raise_exception=True)
        bc = serializer.save()
        self.assertEqual(bc.functional_code, '03 12 00 039')
        self.assertIsNone(bc.economic_code)


class PlanShareValidationTestCase(TestCase):
    """Запрос фронтенда 2026-11-14 (frontend/docs/CurrentStatus.md): распределение лимита по
    подразделениям (/api/plan_shares/) должно (1) реально проверять превышение суммы и
    (2) возвращать чистый 400 через сериализатор, а не необработанный 500 из модели.

    Правка 2026-11-17 (по решению пользователя, см. CurrentStatus.md): запрет на превышение
    КОЛИЧЕСТВА (shared_amount) убран из PlanShare.clean() — "количество" в реестре закупок
    оказалось ненадёжной величиной (формальная единица для услуг, задвоенные сводные строки
    без номера договора — см. input/q_fin_planshare_duplicates_20261117.txt), поэтому её
    больше не блокируем. Контроль СУММЫ (shared_cost) остаётся обязательным."""

    def setUp(self):
        self.purchases = Purchases.objects.create(year=2026)
        self.dept_a = Department.objects.create(full_name='Управление А', short_name='УА')
        self.dept_b = Department.objects.create(full_name='Управление Б', short_name='УБ')

    def _make_item(self, num, item_type, val_amount, fund_cost=Decimal('0'), inner_cost=Decimal('0')):
        plan_item = PlanItem.objects.create(plan_purchase=self.purchases, num=num, is_public=True)
        PlanItemDetail.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, num=num, title='Тестовая позиция',
            okrb='00.00.00.000', type=item_type, val_amount=val_amount,
            fund_cost=fund_cost, inner_cost=inner_cost,
        )
        return plan_item

    def test_quantity_overflow_no_longer_rejected(self):
        """Бывший /plan-items/2898 (val_amount=153): раньше превышение количества блокировалось
        для услуги (type=job) в рамках одного года — теперь по решению пользователя количество
        не проверяется вовсе, сумма при этом по-прежнему укладывается в лимит и сохраняется."""
        plan_item = self._make_item('2026-TEST-PS-1', ProcurementItemTypes.job, Decimal('153'))
        budget_cost = BudgetCosts.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=1,
            cost=Decimal('72600.00'), year=2026,
        )
        PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=budget_cost, department=self.dept_a,
            shared_amount=Decimal('100'), shared_cost=Decimal('47450.98'),
        )
        # 100 + 100 = 200 > val_amount=153 — раньше падало, теперь количество не проверяется.
        share_b = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=budget_cost, department=self.dept_b,
            shared_amount=Decimal('100'), shared_cost=Decimal('25149.02'),
        )
        self.assertEqual(share_b.shared_amount, Decimal('100'))

    def test_quantity_overflow_accepted_by_serializer(self):
        """Превышение количества через /api/plan_shares/ (PATCH существующей строки) больше не
        считается ошибкой — поле просто сохраняется."""
        plan_item = self._make_item('2026-TEST-PS-3', ProcurementItemTypes.product, Decimal('10'))
        budget_cost = BudgetCosts.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=4,
            cost=Decimal('1000.00'), year=2026,
        )
        share = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=budget_cost, department=self.dept_a,
            shared_amount=Decimal('5'), shared_cost=Decimal('500.00'),
        )
        serializer = PlanShareSerializer(share, data={'shared_amount': '20'}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        updated = serializer.save()
        self.assertEqual(updated.shared_amount, Decimal('20'))

    def test_cost_overflow_rejected_by_serializer_as_clean_400(self):
        """То же самое для суммы (shared_cost) — найденный пользователем баг: превышение
        суммы падало в HTTP 500 вместо понятной ошибки валидации поля."""
        plan_item = self._make_item('2026-TEST-PS-4', ProcurementItemTypes.product, Decimal('10'))
        budget_cost = BudgetCosts.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=5,
            cost=Decimal('1000.00'), year=2026,
        )
        share = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=budget_cost, department=self.dept_a,
            shared_amount=Decimal('5'), shared_cost=Decimal('500.00'),
        )
        serializer = PlanShareSerializer(share, data={'shared_cost': '1500.00'}, partial=True)
        self.assertFalse(serializer.is_valid())
        self.assertIn('shared_cost', serializer.errors)

    def test_valid_distribution_within_limits_accepted_by_serializer(self):
        plan_item = self._make_item('2026-TEST-PS-5', ProcurementItemTypes.product, Decimal('10'))
        budget_cost = BudgetCosts.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=6,
            cost=Decimal('1000.00'), year=2026,
        )
        serializer = PlanShareSerializer(data={
            'status': PlanItemStatus.ACTIVE, 'budget_cost': budget_cost.pk, 'department': self.dept_a.pk,
            'shared_amount': '5', 'shared_cost': '500.00',
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        share = serializer.save()
        self.assertEqual(share.shared_amount, Decimal('5'))


class PlanItemContractsCountTestCase(TestCase):
    """Запрос фронтенда (doc/frontend_handoff.md, раздел 9.1, 2026-11-05): `contracts_count` —
    число УНИКАЛЬНЫХ договоров у позиции, а не строк `ContractItem` (у одного договора может
    быть несколько строк на разные подразделения/части позиции — см. CurrentStatus.md, пример
    `2026-102377498-66`, 14 договоров на охрану от разных отделов). Поле `contracts` (boolean)
    не меняется — проверяем, что обе формы отдаются одновременно."""

    def setUp(self):
        self.purchases = Purchases.objects.create(year=2027)
        department_a = Department.objects.create(full_name='Упр. А (CC)', short_name='УА-CC')
        department_b = Department.objects.create(full_name='Упр. Б (CC)', short_name='УБ-CC')
        self.plan_item = PlanItem.objects.create(plan_purchase=self.purchases, num='2027-TEST-CC-1', is_public=True)
        PlanItemDetail.objects.create(
            plan_item=self.plan_item, status=PlanItemStatus.ACTIVE, num=self.plan_item.num,
            title='Тестовая позиция CC', okrb='00.00.00.000', val_amount=Decimal('10'),
        )
        budget_cost = BudgetCosts.objects.create(
            plan_item=self.plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=1,
            cost=Decimal('1000.00'), year=2027,
        )
        self.share_a = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=budget_cost, department=department_a,
            shared_amount=Decimal('5'), shared_cost=Decimal('500.00'),
        )
        self.share_b = PlanShare.objects.create(
            status=PlanItemStatus.ACTIVE, budget_cost=budget_cost, department=department_b,
            shared_amount=Decimal('5'), shared_cost=Decimal('500.00'),
        )
        self.supplier = Supplier.objects.create(name='Тестовый поставщик CC')

    def _get_item(self):
        response = self.client.get('/api/plan_items/', {'purchase': self.purchases.id, 'limit': 50})
        self.assertEqual(response.status_code, 200)
        return next(r for r in response.json()['results'] if r['id'] == self.plan_item.id)

    def test_no_contracts(self):
        item = self._get_item()
        self.assertFalse(item['contracts'])
        self.assertEqual(item['contracts_count'], 0)

    def test_two_contract_items_on_same_contract_counts_once(self):
        contract = Contract.objects.create(
            number='CC-1', supplier=self.supplier, total_cost=Decimal('1000.00'),
            planned_delivery_date='2027-12-31',
        )
        ContractItem.objects.create(
            contract=contract, plan_share=self.share_a, contract_amount=Decimal('5'), contract_cost=Decimal('500.00'),
        )
        ContractItem.objects.create(
            contract=contract, plan_share=self.share_b, contract_amount=Decimal('5'), contract_cost=Decimal('500.00'),
        )

        item = self._get_item()
        self.assertTrue(item['contracts'])
        self.assertEqual(item['contracts_count'], 1)  # не 2 — один договор, две строки

    def test_two_different_contracts_counts_two(self):
        contract1 = Contract.objects.create(
            number='CC-2', supplier=self.supplier, total_cost=Decimal('500.00'), planned_delivery_date='2027-12-31',
        )
        contract2 = Contract.objects.create(
            number='CC-3', supplier=self.supplier, total_cost=Decimal('500.00'), planned_delivery_date='2027-12-31',
        )
        ContractItem.objects.create(
            contract=contract1, plan_share=self.share_a, contract_amount=Decimal('5'), contract_cost=Decimal('500.00'),
        )
        ContractItem.objects.create(
            contract=contract2, plan_share=self.share_b, contract_amount=Decimal('5'), contract_cost=Decimal('500.00'),
        )

        item = self._get_item()
        self.assertTrue(item['contracts'])
        self.assertEqual(item['contracts_count'], 2)


class PlanItemDetailDirectEditTestCase(TestCase):
    """КРИТИЧНЫЙ БАГ (найден агентом-фронтендом, 2026-11-16): PlanItemDetailSerializer.update()
    принудительно сбрасывал status в DRAFT при ЛЮБОМ PATCH, даже не затрагивающем status вовсе
    (напр. {"buyer": ...}) — ломало прямое редактирование полей ACTIVE-записи, разрешённое роли
    FINANCIER (buyer/internal_economic_class, см. core/choices.py) без ChangeRequest. Воспроизведено
    на реальных данных, PlanItemDetail.id=2898 — см. CurrentStatus.md."""

    def setUp(self):
        purchases = Purchases.objects.create(year=2027)
        plan_item = PlanItem.objects.create(plan_purchase=purchases, num='2027-TEST-PID-1', is_public=True)
        self.buyer_a = Buyer.objects.create(shot_name='Иванов И.И. (PID)', full_name='Иванов Иван Иванович (PID)')
        self.buyer_b = Buyer.objects.create(shot_name='Петров П.П. (PID)', full_name='Петров Пётр Петрович (PID)')
        self.detail = PlanItemDetail.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, num=plan_item.num,
            title='Тестовая позиция PID', okrb='00.00.00.000', val_amount=Decimal('1'), buyer=self.buyer_a,
        )

    def test_patch_without_status_does_not_reset_active_record(self):
        serializer = PlanItemDetailSerializer(self.detail, data={'buyer': self.buyer_b.pk}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        instance = serializer.save()
        self.assertEqual(instance.status, PlanItemStatus.ACTIVE)
        self.assertEqual(instance.buyer_id, self.buyer_b.pk)

    def test_patch_reaffirming_same_active_status_is_a_noop(self):
        serializer = PlanItemDetailSerializer(
            self.detail, data={'status': PlanItemStatus.ACTIVE, 'buyer': self.buyer_b.pk}, partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        instance = serializer.save()
        self.assertEqual(instance.status, PlanItemStatus.ACTIVE)

    def test_direct_activation_of_draft_is_rejected(self):
        self.detail.status = PlanItemStatus.DRAFT
        self.detail.save(update_fields=['status'])

        serializer = PlanItemDetailSerializer(self.detail, data={'status': PlanItemStatus.ACTIVE}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        with self.assertRaises(DRFValidationError):
            serializer.save()

        self.detail.refresh_from_db()
        self.assertEqual(self.detail.status, PlanItemStatus.DRAFT)  # не тронут, не задвоился до ACTIVE

    def test_patch_to_non_active_status_still_allowed(self):
        serializer = PlanItemDetailSerializer(self.detail, data={'status': PlanItemStatus.ARCHIVE}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        instance = serializer.save()
        self.assertEqual(instance.status, PlanItemStatus.ARCHIVE)


class BudgetCostsDirectEditTestCase(TestCase):
    """Тот же баг, что в PlanItemDetailDirectEditTestCase выше — копипаста между двумя
    сериализаторами (BudgetCostsSerializer.update() / PlanItemDetailSerializer.update()).
    Живьём воспроизведено на BudgetCosts.id=2915 при проверке фикса PlanItemDetail: PATCH
    {"internal_economic_class": <то же значение>} тихо откатывал ACTIVE-запись в DRAFT."""

    def setUp(self):
        purchases = Purchases.objects.create(year=2027)
        plan_item = PlanItem.objects.create(plan_purchase=purchases, num='2027-TEST-BC-1', is_public=True)
        self.iec_a = InternalEconomicClassifier.objects.create(code='9990000001', name='Тестовая статья А')
        self.iec_b = InternalEconomicClassifier.objects.create(code='9990000002', name='Тестовая статья Б')
        self.budget_cost = BudgetCosts.objects.create(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE, purchases_items_id=1,
            cost=Decimal('1000.00'), year=2027, internal_economic_class=self.iec_a,
        )

    def test_patch_without_status_does_not_reset_active_record(self):
        serializer = BudgetCostsSerializer(
            self.budget_cost, data={'internal_economic_class': self.iec_b.pk}, partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        instance = serializer.save()
        self.assertEqual(instance.status, PlanItemStatus.ACTIVE)
        self.assertEqual(instance.internal_economic_class_id, self.iec_b.pk)

    def test_direct_activation_of_draft_is_rejected(self):
        self.budget_cost.status = PlanItemStatus.DRAFT
        self.budget_cost.save(update_fields=['status'])

        serializer = BudgetCostsSerializer(self.budget_cost, data={'status': PlanItemStatus.ACTIVE}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        with self.assertRaises(DRFValidationError):
            serializer.save()

        self.budget_cost.refresh_from_db()
        self.assertEqual(self.budget_cost.status, PlanItemStatus.DRAFT)
