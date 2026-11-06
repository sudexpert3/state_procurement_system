from decimal import Decimal
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext

from core.choices import ChangeRequestKind, ChangeRequestStatus, PlanItemStatus, QuarterTypes
from procurement.models import (
    PlanItem, PlanItemDetail, BudgetCosts, PlanShare, Department, Contract, ContractItem,
    Supplier, Purchases, ChangeRequest, BudgetQuarterlyLimit, InternalEconomicClassifier,
    TreasuryPayment, KindOfPayment, ContractQuarterlyFinance,
)
from procurement.serializers.treasuryPayment import TreasuryPaymentSerializer
from procurement.serializers.contractQuarterlyFinance import ContractQuarterlyFinanceSerializer
from procurement.serializers.budgetCosts import BudgetCostsImportSerializer
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

    def test_no_data_for_other_quarter(self):
        BudgetQuarterlyLimit.objects.create(
            plan_share=self.plan_share, budget_cost=self.budget_cost, quarter=QuarterTypes.Q1,
            amount=Decimal('200.00'),
        )
        rows = compute_budget_execution_report(year=2026, department_id=self.department.pk, quarter=QuarterTypes.Q2)
        self.assertEqual(rows, [])


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
    """Приём корректировок лимитов от Казначейства (Этап 3.4) — агрегатный уровень статьи."""

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
        self.assertEqual(cr.status, ChangeRequestStatus.DRAFT)

        forecast = cr_service.compute_forecast(cr)
        self.assertEqual(forecast['lines'][0]['old_amount'], Decimal('0'))
        self.assertEqual(forecast['lines'][0]['delta'], Decimal('9831556.00'))

        cr_service.submit(cr)
        cr_service.approve(cr)

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
        cr_service.submit(cr1)
        cr_service.approve(cr1)

        cr2 = cr_service.create_budget_limit_correction([
            {'functional_class': self.func.pk, 'economic_class': self.econ.pk,
             'year': 2026, 'quarter': QuarterTypes.Q1, 'amount': Decimal('150.00')},
        ])
        forecast = cr_service.compute_forecast(cr2)
        self.assertEqual(forecast['lines'][0]['old_amount'], Decimal('100.00'))
        self.assertEqual(forecast['lines'][0]['delta'], Decimal('50.00'))

        cr_service.submit(cr2)
        cr_service.approve(cr2)

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


class DepartmentLimitCalibrationTestCase(TestCase):
    """Калибровка разбивки статьи Минфина на подстатьи/держателей лимита (решение
    пользователя 2026-11-03, kind=DEPARTMENT_LIMIT_CALIBRATION)."""

    def setUp(self):
        from procurement.models import FunctionalCode, ExternalEconomicCode, ArticleQuarterlyAllocation
        self.func = FunctionalCode.objects.create(code_api='03 12 00 039', description='ГКСЭ')
        self.econ = ExternalEconomicCode.objects.create(code_api='1 10 03 99', description='Расходные материалы')
        self.iec_a = InternalEconomicClassifier.objects.create(code='1100300001', name='Подстатья А')
        self.iec_b = InternalEconomicClassifier.objects.create(code='1100300002', name='Подстатья Б')
        self.dept1 = Department.objects.create(full_name='Отдел 1', short_name='О1')
        self.dept2 = Department.objects.create(full_name='Отдел 2', short_name='О2')
        for q in [QuarterTypes.Q1, QuarterTypes.Q2, QuarterTypes.Q3, QuarterTypes.Q4]:
            ArticleQuarterlyAllocation.objects.create(
                functional_class=self.func, economic_class=self.econ, year=2026, quarter=q,
                amount=Decimal('125000.00'),
            )
        # Итого по статье за год: 500000.00

    def _balanced_lines(self):
        from procurement.models import DepartmentArticleLimit
        return [
            {'functional_class': self.func, 'economic_class': self.econ,
             'internal_economic_class': self.iec_a, 'department': None, 'year': 2026,
             'amount': Decimal('300000.00'), 'status': PlanItemStatus.DRAFT},
            {'functional_class': self.func, 'economic_class': self.econ,
             'internal_economic_class': self.iec_a, 'department': self.dept1, 'year': 2026,
             'amount': Decimal('200000.00'), 'status': PlanItemStatus.DRAFT},
            {'functional_class': self.func, 'economic_class': self.econ,
             'internal_economic_class': self.iec_a, 'department': self.dept2, 'year': 2026,
             'amount': Decimal('100000.00'), 'status': PlanItemStatus.DRAFT},
            {'functional_class': self.func, 'economic_class': self.econ,
             'internal_economic_class': self.iec_b, 'department': None, 'year': 2026,
             'amount': Decimal('200000.00'), 'status': PlanItemStatus.DRAFT},
            {'functional_class': self.func, 'economic_class': self.econ,
             'internal_economic_class': self.iec_b, 'department': self.dept1, 'year': 2026,
             'amount': Decimal('200000.00'), 'status': PlanItemStatus.DRAFT},
        ]

    def test_create_calibration_starts_empty_when_no_active_rows(self):
        cr = cr_service.create_department_limit_calibration(
            functional_class_id=self.func.pk, economic_class_id=self.econ.pk, year=2026,
        )
        self.assertEqual(cr.kind, ChangeRequestKind.DEPARTMENT_LIMIT_CALIBRATION)
        self.assertEqual(cr.draft_department_limits.count(), 0)

    def test_underallocated_draft_is_allowed(self):
        """Недораспределение — нормальное состояние (пример пользователя: план - резерв -
        доведено = нераспределённые лимиты, положительный остаток). НЕ должно блокировать
        применение калибровки."""
        from procurement.models import DepartmentArticleLimit
        cr = cr_service.create_department_limit_calibration(
            functional_class_id=self.func.pk, economic_class_id=self.econ.pk, year=2026,
        )
        # Подстатья покрывает только 300000 из доступных 500000 — остаток 200000 остаётся
        # нераспределённым, это допустимо.
        DepartmentArticleLimit.objects.create(
            functional_class=self.func, economic_class=self.econ, internal_economic_class=self.iec_a,
            department=None, year=2026, amount=Decimal('300000.00'),
            status=PlanItemStatus.DRAFT, change_request=cr,
        )
        forecast = cr_service.compute_forecast(cr)
        self.assertTrue(forecast['is_balanced'])
        self.assertEqual(forecast['article_diff'], Decimal('200000.00'))

        cr_service.submit(cr)
        cr_service.approve(cr)  # не должно поднимать ValidationError
        self.assertEqual(
            DepartmentArticleLimit.objects.filter(status=PlanItemStatus.ACTIVE).count(), 1,
        )

    def test_overallocated_draft_rejected_on_approve(self):
        """Перерасход — подстатьям раздали больше, чем реально доступно статье. Это
        единственное, что должно блокировать применение калибровки."""
        from procurement.models import DepartmentArticleLimit
        cr = cr_service.create_department_limit_calibration(
            functional_class_id=self.func.pk, economic_class_id=self.econ.pk, year=2026,
        )
        DepartmentArticleLimit.objects.create(
            functional_class=self.func, economic_class=self.econ, internal_economic_class=self.iec_a,
            department=None, year=2026, amount=Decimal('600000.00'),  # больше доступных 500000
            status=PlanItemStatus.DRAFT, change_request=cr,
        )
        forecast = cr_service.compute_forecast(cr)
        self.assertFalse(forecast['is_balanced'])
        self.assertEqual(forecast['article_diff'], Decimal('-100000.00'))

        cr_service.submit(cr)
        with self.assertRaises(ValidationError):
            cr_service.approve(cr)

    def test_balanced_draft_approves_and_creates_active_rows(self):
        from procurement.models import DepartmentArticleLimit
        cr = cr_service.create_department_limit_calibration(
            functional_class_id=self.func.pk, economic_class_id=self.econ.pk, year=2026,
        )
        for line in self._balanced_lines():
            DepartmentArticleLimit.objects.create(change_request=cr, **line)

        forecast = cr_service.compute_forecast(cr)
        self.assertTrue(forecast['is_balanced'])
        self.assertEqual(forecast['article_diff'], Decimal('0'))
        for b in forecast['subarticle_balance']:
            self.assertEqual(b['diff'], Decimal('0'))

        cr_service.submit(cr)
        cr_service.approve(cr)

        active = DepartmentArticleLimit.objects.filter(status=PlanItemStatus.ACTIVE)
        self.assertEqual(active.count(), 5)
        dept1_a = active.get(internal_economic_class=self.iec_a, department=self.dept1)
        self.assertEqual(dept1_a.amount, Decimal('200000.00'))

    def test_second_calibration_seeds_from_active_and_archives_stale(self):
        from procurement.models import DepartmentArticleLimit
        cr1 = cr_service.create_department_limit_calibration(
            functional_class_id=self.func.pk, economic_class_id=self.econ.pk, year=2026,
        )
        for line in self._balanced_lines():
            DepartmentArticleLimit.objects.create(change_request=cr1, **line)
        cr_service.submit(cr1)
        cr_service.approve(cr1)

        # Новая калибровка должна подхватить 5 уже ACTIVE строк как стартовые черновики.
        cr2 = cr_service.create_department_limit_calibration(
            functional_class_id=self.func.pk, economic_class_id=self.econ.pk, year=2026,
        )
        self.assertEqual(cr2.draft_department_limits.count(), 5)

        # Специалист ошибочно УВЕЛИЧИВАЕТ долю держателя (200000 -> 250000 для dept1/iec_b),
        # не увеличив саму подстатью iec_b (осталась 200000) — держателю раздали больше, чем
        # есть в подстатье (перерасход), approve() должен отказать.
        draft_to_edit = cr2.draft_department_limits.get(
            internal_economic_class=self.iec_b, department=self.dept1,
        )
        draft_to_edit.amount = Decimal('250000.00')
        draft_to_edit.save()

        forecast = cr_service.compute_forecast(cr2)
        self.assertFalse(forecast['is_balanced'])
        cr_service.submit(cr2)
        with self.assertRaises(ValidationError):
            cr_service.approve(cr2)
        # Старый снимок остаётся ACTIVE нетронутым, пока неодобренная заявка не применена.
        self.assertEqual(DepartmentArticleLimit.objects.filter(status=PlanItemStatus.ACTIVE).count(), 5)

    def test_reconciliation_target_excludes_prior_years_reservation(self):
        """План 500000, резерв прошлых лет 150000 — сверка должна требовать сумму подстатей
        == 350000 (500000-150000), а НЕ полных 500000 (пример пользователя 2026-11-03)."""
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
        # Многолетний резерв "наперёд" на 2026 год — договор заключён под строкой 2025 года.
        ContractItem.objects.create(
            contract=contract, plan_share=ps_2025, year=2026,
            contract_amount=Decimal('1'), contract_cost=Decimal('150000.00'),
        )

        cr = cr_service.create_department_limit_calibration(
            functional_class_id=self.func.pk, economic_class_id=self.econ.pk, year=2026,
        )
        from procurement.models import DepartmentArticleLimit
        # Подстатья на оставшиеся 350000 (не 500000) — должно сойтись.
        DepartmentArticleLimit.objects.create(
            functional_class=self.func, economic_class=self.econ, internal_economic_class=self.iec_a,
            department=None, year=2026, amount=Decimal('350000.00'),
            status=PlanItemStatus.DRAFT, change_request=cr,
        )
        forecast = cr_service.compute_forecast(cr)
        self.assertEqual(forecast['prior_years_obligations'], Decimal('150000.00'))
        self.assertEqual(forecast['article_available'], Decimal('350000.00'))
        self.assertEqual(forecast['article_diff'], Decimal('0'))


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

        # Доведённые лимиты — подстатья В на 250000 (сумма держателей сознательно МЕНЬШЕ
        # (150000+50000=200000), чтобы заодно проверить, что это не блокирует и не обязано
        # совпадать для целей САМОГО ОТЧЁТА — калибровка со своей сверкой тестируется отдельно).
        DepartmentArticleLimit.objects.create(
            functional_class=self.func, economic_class=self.econ, internal_economic_class=self.iec,
            department=None, year=2026, amount=Decimal('250000.00'), status=PlanItemStatus.ACTIVE,
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


class PlanItemCodeFilterTestCase(TestCase):
    """Серверная фильтрация /api/plan_items/ по functional_code/economic_code/
    internal_economic_code (запрошено фронтендом 2026-11-06, см. CurrentStatus.md Этап 4.5) —
    раньше эти query-параметры молча игнорировались, фронт был вынужден грузить весь
    реестр года и фильтровать на клиенте."""

    def setUp(self):
        self.purchases = Purchases.objects.create(year=2026)
        self.iec_a = InternalEconomicClassifier.objects.create(code='1101008173', name='Статья А')
        self.iec_b = InternalEconomicClassifier.objects.create(code='1101008999', name='Статья Б')

        self.item_a = PlanItem.objects.create(plan_purchase=self.purchases, num='2026-TEST-F-1', is_public=True)
        PlanItemDetail.objects.create(
            plan_item=self.item_a, status=PlanItemStatus.ACTIVE, num='2026-TEST-F-1',
            title='Позиция A', okrb='00.00.00.000', val_amount=Decimal('1'),
        )
        BudgetCosts.objects.create(
            plan_item=self.item_a, status=PlanItemStatus.ACTIVE, purchases_items_id=101,
            cost=Decimal('1000.00'), year=2026, functional_code='03 12 00 039',
            economic_code='1 10 10 99', internal_economic_class=self.iec_a,
        )

        self.item_b = PlanItem.objects.create(plan_purchase=self.purchases, num='2026-TEST-F-2', is_public=True)
        PlanItemDetail.objects.create(
            plan_item=self.item_b, status=PlanItemStatus.ACTIVE, num='2026-TEST-F-2',
            title='Позиция Б', okrb='00.00.00.000', val_amount=Decimal('1'),
        )
        BudgetCosts.objects.create(
            plan_item=self.item_b, status=PlanItemStatus.ACTIVE, purchases_items_id=102,
            cost=Decimal('2000.00'), year=2026, functional_code='03 12 00 042',
            economic_code='2 40 01 00', internal_economic_class=self.iec_b,
        )

        # Вторая, уже архивная строка бюджета позиции A с ДРУГИМ кодом — не должна попадать
        # в фильтр (проверяет, что фильтр учитывает только ACTIVE, как и остальной API).
        BudgetCosts.objects.create(
            plan_item=self.item_a, status=PlanItemStatus.ARCHIVE, purchases_items_id=101,
            cost=Decimal('900.00'), year=2025, functional_code='03 12 00 042',
            economic_code='2 40 01 00', internal_economic_class=self.iec_b,
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
