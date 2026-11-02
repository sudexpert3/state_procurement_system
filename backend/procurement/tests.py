from decimal import Decimal

from django.core.exceptions import ValidationError
from django.test import TestCase

from core.choices import ChangeRequestKind, ChangeRequestStatus, PlanItemStatus, QuarterTypes
from procurement.models import (
    PlanItem, PlanItemDetail, BudgetCosts, PlanShare, Department, Contract, ContractItem,
    Supplier, Purchases, ChangeRequest, BudgetQuarterlyLimit, InternalEconomicClassifier,
    TreasuryPayment, KindOfPayment, ContractQuarterlyFinance,
)
from procurement.serializers.treasuryPayment import TreasuryPaymentSerializer
from procurement.serializers.contractQuarterlyFinance import ContractQuarterlyFinanceSerializer
from procurement.services import change_requests as cr_service
from procurement.services.budget_execution_report import compute_budget_execution_report
from procurement.services.multi_year_reservation import compute_reserved_amount, compute_available_for_distribution


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
