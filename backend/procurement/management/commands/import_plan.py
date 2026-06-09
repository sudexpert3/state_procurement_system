import openpyxl
from datetime import datetime
from decimal import Decimal
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Импорт плана закупок из широкой таблицы Excel'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='Путь к файлу .xlsx')

    def parse_decimal(self, value):
        """Безопасное приведение ячейки к Decimal"""
        if value is None or str(value).strip() == '' or str(value).strip() == '-':
            return Decimal('0.00')
        try:
            # Убираем пробелы, если Excel сохранил число как строку с разделителями
            clean_val = str(value).replace(' ', '').replace(',', '.').strip()
            return Decimal(clean_val)
        except:
            return Decimal('0.00')

    def parse_date(self, value):
        """Безопасное приведение ячейки к дате"""
        if isinstance(value, datetime):
            return value.date()
        if value is None or str(value).strip() in ['', '-']:
            return None
        try:
            # Пробуем распарсить стандартный формат ДД.ММ.ГГГГ
            return datetime.strptime(str(value).strip(), '%d.%m.%Y').date()
        except ValueError:
            return None

    def handle(self, *args, **options):
        file_path = options['file_path']

        wb = openpyxl.load_workbook(file_path, data_only=True)
        sheet = wb.active

        print(sheet.namespace)

        count_items = 0

        # # ВНИМАНИЕ: Настрой индексы колонок (A=1, B=2, C=3...) в соответствии с твоим файлом!
        # # Ниже приведен пример маппинга на основе визуальной структуры твоей таблицы
        # for row_idx, row in enumerate(sheet.iter_rows(min_row=3, values_only=True), start=3):
        #     # Примерные индексы колонок (замени на реальные индексы из твоей таблицы)
        #     row_num = row[0]  # А: № п/п
        #     okrb_code = row[3]  # D: Код ОКРБ
        #     expense_code = row[7]  # H: Код статьи расходов (10.20.30.40)
        #     expense_name = row[8]  # I: Наименование предмета закупки
        #     budget_amount = row[11]  # L: Текущая сумма
        #     proc_period = row[13]  # N: Срок проведения
        #     contractor_name = row[19]  # T: Поставщик
        #     contract_num = row[21]  # V: № договора
        #     contract_date = row[22]  # W: Дата договора
        #     contract_amount = row[24]  # Y: Сумма договора
        #     spent_amount = row[26]  # AA: Израсходовано
        #
        #     q1 = row[32]  # AH: 1 квартал
        #     q2 = row[34]  # AJ: 2 квартал
        #     q3 = row[36]  # AL: 3 квартал
        #     q4 = row[38]  # AN: 4 квартал
        #
        #     if not expense_code or not expense_name:
        #         continue
        #
        #     # 1. Заполняем справочник статей расходов
        #     expense_item, _ = ExpenseItem.objects.get_or_create(
        #         code=str(expense_code).strip(),
        #         defaults={'name': str(expense_name).strip()}
        #     )
        #
        #     # 2. Заполняем справочник контрагентов (если указан)
        #     contract = None
        #     if contractor_name and str(contractor_name).strip() != '-':
        #         contractor, _ = Contractor.objects.get_or_create(
        #             name=str(contractor_name).strip()
        #         )
        #
        #         # 3. Заполняем справочник договоров
        #         if contract_num and str(contract_num).strip() != '-':
        #             contract, _ = Contract.objects.get_or_create(
        #                 number=str(contract_num).strip(),
        #                 date=self.parse_date(contract_date),
        #                 defaults={
        #                     'contractor': contractor,
        #                     'total_amount': self.parse_decimal(contract_amount)
        #                 }
        #             )
        #
        #     # 4. Создаем саму финансовую запись плана закупок
        #     ProcurementItem.objects.create(
        #         organization=default_org,
        #         expense_item=expense_item,
        #         contract=contract,
        #         row_number=str(row_num or ''),
        #         okrb_code=str(okrb_code or ''),
        #         total_budget_amount=self.parse_decimal(budget_amount),
        #         fact_spent=self.parse_decimal(spent_amount),
        #         q1_amount=self.parse_decimal(q1),
        #         q2_amount=self.parse_decimal(q2),
        #         q3_amount=self.parse_decimal(q3),
        #         q4_amount=self.parse_decimal(q4),
        #         procurement_period=str(proc_period or ''),
        #     )
        #     count_items += 1

        self.stdout.write(self.style.SUCCESS(f'Импорт завершен! Успешно загружено строк плана: {count_items}'))

        # При получении данных data ГПЗ с goszakupki.by
        # data = {...
        # ваш
        # JSON...}
        #
        # # Создаем или обновляем пункт плана
        # plan_obj, created = Plan.objects.update_or_create(
        #     id=data['id'],
        #     defaults={
        #         'purchases_id': data['purchases_id'],
        #         'unp_budget': data['unp_budget'],
        #         'num': data['num'],
        #         'title': data['title'],
        #         'okrb': data['okrb'],
        #         'okrb_title': data['okrb_title'],
        #         'type': data['type'],
        #         'val_amount': data['val_amount'],
        #         'val_type': data['val_type'],
        #         'val_currency': data['val_currency'],
        #         'fund_cost': data['fund_cost'],
        #         'inner_cost': data['inner_cost'],
        #         'procedure_months': data['procedure_months'],
        #         'is_by_organizator': data['is_by_organizator'],
        #     }
        # )
        #
        # # Записываем его финансовые года
        # for cost_data in data['budget_costs']:
        #     BudgetCosts.objects.update_or_create(
        #         plan=plan_obj,
        #         year=cost_data['year'],
        #         economic_code=cost_data['economic_code'],  # добавляем для уникальности
        #         defaults={
        #             'cost': cost_data['cost'],
        #             'functional_code': cost_data['functional_code'],
        #             'department_code': cost_data['department_code'],
        #             'program_code': cost_data['program_code'],
        #             'budget_code': cost_data['budget_code'],
        #             'budget_code_name': cost_data['budget_code_name'],
        #             'unk': cost_data['unk'],
        #             'tk_id': cost_data['tk_id'],
        #         }
        #     )
