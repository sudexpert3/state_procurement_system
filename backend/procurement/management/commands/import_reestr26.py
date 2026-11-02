# -*- coding: utf-8 -*-
"""
Разовый перенос листа "реестр 26" из input/rd26.xlsx в БД.

Структура и правила согласованы с пользователем по ходу разбора (см. CurrentStatus.md,
Этап 1). Колонка `num` (G) не всегда содержит настоящий номер позиции с goszakupki.by —
специалист размечает служебными метками строки, которые нужно обрабатывать иначе:

  1. "не публ.часть. Оборон заказ" / "не план. Не публикуется..." —
     полноценная НЕПУБЛИКУЕМАЯ позиция плана текущего (2026) года, которой нет на портале.
     Создаём PlanItem(is_public=False) с автономером + PlanItemDetail + BudgetCosts прямо
     из данных строки.
  2. "не публ.часть. Административная процедура." —
     PlanItem НЕ создаётся. Фиксируется TreasuryPayment (KindOfPayment "Административные
     процедуры"), без привязки к плану.
  3. "не публ.часть. Ежегодный свободный платеж без договора." —
     аналогично (2), KindOfPayment "Свободный платёж".
  4. "многолетняя закупка. Договор 2025 года..." / "позиция 20XX года. Оплата за счет
     дс 2026 года..." — переходящая позиция ИЗ ПЛАНА ПРОШЛЫХ ЛЕТ (2024/2025), которые
     уже есть в БД (см. sync_goszakupki_from_file). Настоящего номера реестр не даёт —
     позиция ищется по совпадению наименования (H) + кода ОКРБ (I) среди позиций плана
     указанного года (нечёткое сравнение, порог уверенности — см. CARRYOVER_MATCH_THRESHOLD).
     При уверенном совпадении для найденной позиции ГАРАНТИРОВАННО создаётся BudgetCosts
     на 2026 год (его там нет — портал этот перенос не публикует), дальше — как обычно.
  5. Любой другой `num` — обычная позиция, ищется по точному совпадению (уже наполнена
     синхронизацией с goszakupki.by, см. sync_goszakupki_from_file) и дополняется тем,
     чего в публичных данных портала нет: internal_economic_class, PlanShare, Contract/
     ContractItem, ContractQuarterlyFinance.

Колонка V ("Держатель лимита") — однозначное подразделение, на баланс которого относится
лимит (-> PlanShare). Колонка W ("Управление для кого закупка") — подразделения-бенефициары
(может быть несколько через запятую) -> PlanItemDetail.beneficiary_departments, лимит на
них не уменьшается.

Каждая строка обрабатывается под своим savepoint: если строка нарушает валидацию модели
(мусор/опечатка в исходных данных), откатывается только она — остальной импорт продолжается,
а строка попадает в отчёт как "row_errors".

Повторный запуск с --apply идемпотентен для непубликуемых позиций и платёжек без плана —
сам реестр не даёт устойчивого идентификатора для этих строк. Непубликуемые позиции
сопоставляются по содержимому — (год, название, количество), см. existing_non_public_by_key;
платёжки — по порядку среди себе подобных, см. existing_payments_by_kind (для них это
безопаснее, т.к. все платежи одного вида в пределах строки идут по кварталам последовательно).

Запуск:
    python manage.py import_reestr26                  # только отчёт, ничего не пишет в БД
    python manage.py import_reestr26 --apply           # реально сохраняет изменения
    python manage.py import_reestr26 --file path.xlsx  # другой файл вместо input/rd26.xlsx
"""
import datetime
import difflib
import re
from collections import defaultdict
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

import openpyxl
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import transaction

from core.choices import QuarterTypes, PlanItemStatus, ProcurementItemTypes
from procurement.models import (
    PlanItem, PlanItemDetail, BudgetCosts, PlanShare, Department, Contract, ContractItem,
    ContractQuarterlyFinance, Supplier, Buyer, InternalEconomicClassifier, TreasuryPayment, KindOfPayment,
    Purchases, OkrbProduct, UnitOfMeasurement, FunctionalCode, ProgramCode, ExternalEconomicCode,
)

SHEET_NAME = 'реестр 26'

# Индексы колонок (1-based). A-U (1-21) не менялись с прошлой версии файла.
COL_ECON_SUFFIX = 4                          # D — последние 3 цифры внутреннего кода
COL_ARTICLE = 5                              # E — "под.элемент" (7-значный внутренний код-статья)
COL_NUM = 7                                  # G — num позиции плана / служебная метка
COL_TITLE = 8                                # H — наименование предмета закупки
COL_OKRB_CODE = 9                            # I — код ОКРБ 007
COL_OKRB_TITLE = 10                          # J — наименование по ОКРБ 007
COL_KIND = 11                                # K — товар/работа/услуга
COL_AMOUNT = 12                              # L — количество для подразделения
COL_UNIT = 13                                # M — единица измерения (текстом)
COL_COST = 14                                # N — сумма плана для подразделения
COL_FUND_COST = 15                           # O — счета заказчика (внебюджетные фонды)
COL_INNER_COST = 16                          # P — собственные счета
COL_PROC_MONTH = 17                          # Q — срок проведения процедуры
COL_R_CODES = 18                             # R — "Функ. кл. / Экон. кл. / Прог. кл. / Ведом. кл."
COL_PERV_SUM = 20                            # T — первичная сумма плана (по всей позиции)
COL_BUYER = 21                               # U — Исполнитель
# --- новые/сдвинутые колонки (после добавления "Держатель лимита") ---
COL_DEPT_HOLDER = 22                         # V — Держатель лимита (однозначно, -> PlanShare)
COL_DEPT_BENEFICIARY = 23                    # W — Управление для кого закупка (-> beneficiary_departments)
COL_YEAR = 24                                # X — Год
COL_CONTRACT_NUM = 25                        # Y
COL_CONTRACT_DATE = 26                       # Z
COL_SUPPLIER = 27                            # AA
COL_CONTRACT_ROW_COST = 28                   # AB — сумма договора на эту строку/подразделение
COL_IS_REGISTERED_TK = 31                    # AE
COL_PAYMENT_TERMS = 33                       # AG
COL_DELIVERY_DATE = 34                       # AH
COL_CATEGORY_AK = 37                         # AK — "Категория расходов" (для notice платёжек)
COL_WORKS_AL = 38                            # AL — "виды работ/объект тек./кап. ремонтов" (для notice)
COL_PLAN_NUM_AQ = 43                         # AQ — "№ плана" (для notice)
QUARTER_COLS = [
    (QuarterTypes.Q1, 49, 50),   # AW финансирование (факт) / AX подлежит к оплате
    (QuarterTypes.Q2, 51, 52),   # AY / AZ
    (QuarterTypes.Q3, 53, 54),   # BA / BB
    (QuarterTypes.Q4, 55, 56),   # BC / BD
]

# Разумный потолок на сумму (модели используют DecimalField(max_digits=15, decimal_places=2) —
# т.е. до 9 999 999 999 999,99). Значения за этим пределом — почти наверняка брак в исходных
# данных (битая ячейка/формула), а не реальная сумма закупки ГКСЭ.
MAX_SANE_COST = Decimal('9999999999999.99')

# Порог уверенности нечёткого сопоставления переходящих позиций (см. класс CARRYOVER выше).
# 0.7*схожесть_названия + 0.3*совпадение_ОКРБ; на проверенной выборке уверенные совпадения
# давали >=0.95, ложные — не выше 0.76, так что 0.9 — безопасная граница с запасом.
CARRYOVER_MATCH_THRESHOLD = 0.9

# Точечные ручные сопоставления переходящих позиций, которые не прошли порог нечёткого
# совпадения (названия слишком разные для авто-алгоритма), но специалист подтвердил целевую
# позицию явно (answer_fin.txt, Раздел 1, строки 208/492, уточнено 2026-10-29). Ключ —
# (год источника, нормализованное название строки РЕЕСТРА в нижнем регистре, код ОКРБ);
# значение — num существующей позиции плана, к которой относится платёж. НЕ по номеру строки
# файла (см. урок Прохода 6 — номера строк между версиями файла не стабильны).
CARRYOVER_OVERRIDES = {
    (2025,
     'комплекс организационно-технических мероприятий и услуг по организации содержания, '
     'по управлению общим имуществом совместного домовладения, технического обслуживания, '
     'текущего и капитального ремонта жилого дома (помещение №65 жилого дома №15 по ул.куприянова',
     '68.20.12.000'): '2025-102377498-22',
    (2025, 'коммунальные услуги, куприянова, 15 возложение на 3-е лицо', '35.11.10.900'):
        '2025-102377498-9',
    # Эти 2 строки размечены в файле как "позиция 2025 года" (source_year по марке = 2025),
    # но специалист подтвердил (answer_fin.txt, Раздел 1, строки 1281/1282) — это фактически
    # позиции плана 2023 года (план 2023 синхронизирован 2026-10-29, purchase_id=42511).
    (2025,
     'выбор подрядной организации для выполнения строительно-монтажных, специальных, '
     'пусконаладочных работ, а также закупки оборудования по объекту «модернизация комплекса '
     'зданий (судебно-психиатрический экспертный стационар) по адресу: г. минск, долгиновский '
     'тр-т, 146,146/1,146/2»',
     '41.00.40.300'): '2023-102377498-1835',
    (2025,
     'выбор подрядной организации для оказания инженерных услуг по техническому надзору за '
     'выполнением работ по объекту «модернизация комплекса зданий (судебно-психиатрический '
     'экспертный стационар) по адресу: г. минск, долгиновский тр-т, 146,146/1,146/2»',
     '71.12.19.900'): '2023-102377498-1837',
}

DEPT_SUFFIX_RE = re.compile(r'\s+УТО\b.*$', re.IGNORECASE)
# "Держатель лимита" использует это имя вместо short_name "Жабенко" из справочника Department
# (см. модель — заведено по фамилии главной медсестры, а в реестре пишут должность).
# Алиасы 2026-10-22 — уточнены со специалистом по 66 нераспознанным бенефициарам (W) из q_fin.txt:
#   "ГУСМЭ (УСХЭ/УСБЭ/УСГЭ)" / "ГУФиТ (СООТиПБ УТО)" / "ГУФиТ (ООСиУН)" — пояснение в скобках
#   родительского подразделения, по факту = дочерний отдел;
#   "УСБЭ (УСХЭ)" — опечатка, по факту то же самое, что "ГУСМЭ (УСХЭ)" (= УСХЭ);
#   "УКСД"/"УМПиОСД"/"УРСД" — опечатки/сокращения факт.названий ГУКСД/УМПиОДС/УРСДиД (специалист
#   уже поправил эти строки в самом реестре — алиасы оставлены как подстраховка на случай,
#   если где-то в файле осталось старое написание).
DEPT_ALIASES = {
    'гл.мед.сестра': 'жабенко',
    'гусмэ (усхэ)': 'усхэ',
    'гусмэ (усбэ)': 'усбэ',
    'гусмэ (усгэ)': 'усгэ',
    'усбэ (усхэ)': 'усхэ',
    'уксд': 'гуксд',
    'умпиосд': 'умпиодс',
    'урсд': 'урсдид',
    'гуфит (соотипб уто)': 'соотипб',
    'гуфит (оосиун)': 'оосиун',
}

RE_SOURCE_YEAR = re.compile(r'позиция (\d{4}) года')

MONTHS_RU = {
    'январь': 1, 'февраль': 2, 'март': 3, 'апрель': 4, 'май': 5, 'июнь': 6,
    'июль': 7, 'август': 8, 'сентябрь': 9, 'октябрь': 10, 'ноябрь': 11, 'декабрь': 12,
}

RE_FUNC_CODE = re.compile(r'Функ\.?\s*кл\.?:\s*([\d ]+?)(?=\s*Экон|\s*$)', re.IGNORECASE)
RE_ECON_CODE = re.compile(r'Экон\.?\s*кл\.?:\s*([\d ]+?)(?=\s*Прог|\s*$)', re.IGNORECASE)
RE_PROG_CODE = re.compile(r'Прог\.?\s*кл\.?:\s*([\d ]+?)(?=\s*Ведом|\s*$)', re.IGNORECASE)
RE_VED_CODE = re.compile(r'Ведом\.?\s*кл\.?:\s*([\d ]+)', re.IGNORECASE)

# Конец каждого квартала — используется как дата платежа для строк без плана (категории
# "Административная процедура"/"Свободный платёж"), где реестр не даёт точной даты,
# только квартальную сумму факта.
QUARTER_END_DATE = {
    QuarterTypes.Q1: (3, 31), QuarterTypes.Q2: (6, 30),
    QuarterTypes.Q3: (9, 30), QuarterTypes.Q4: (12, 31),
}

# Начало каждого квартала — дата платежа для "Платеж-перенос из файла" (переходящие позиции,
# категория CARRYOVER): реестр даёт только квартальную сумму факта (AW/AY/BA/BC), точного дня
# нет. Решение пользователя 2026-10-26.
QUARTER_START_DATE = {
    QuarterTypes.Q1: (1, 1), QuarterTypes.Q2: (4, 1),
    QuarterTypes.Q3: (7, 1), QuarterTypes.Q4: (10, 1),
}


def norm_text(s):
    """Схлопывает повторные пробелы и обрезает края — база для сравнения текстовых значений.
    Ячейка может прийти из openpyxl не строкой (int/float/datetime), поэтому сначала приводим к str."""
    if s is None:
        return ''
    return re.sub(r'\s+', ' ', str(s)).strip()


def to_decimal(value, decimal_places=2):
    """Безопасный разбор ячейки в Decimal.
    - Отбрасывает откровенно нереалистичные значения (см. MAX_SANE_COST) — иначе падает
      валидация модели (max_digits=15) и рвёт всю строку.
    - Округляет до decimal_places: openpyxl отдаёт суммы как float с погрешностью
      (например, 5575.490000000002 вместо 5575.49), а DecimalField(decimal_places=2/3)
      требует ровно столько знаков после запятой, сколько указано в поле — без этого
      та же ошибка "не более 15 цифр" вылезает из-за хвоста мусорных разрядов."""
    if value is None or str(value).strip() in ('', '-'):
        return None
    try:
        result = Decimal(str(value).replace(' ', '').replace('\xa0', '').replace(',', '.').strip())
    except InvalidOperation:
        return None
    if abs(result) > MAX_SANE_COST:
        return None
    quantum = Decimal('1').scaleb(-decimal_places)  # напр. decimal_places=2 -> Decimal('0.01')
    result = result.quantize(quantum, rounding=ROUND_HALF_UP)
    return result


def parse_procedure_months(raw):
    """'февраль-июль' -> [2,3,4,5,6,7]; 'Сентябрь' -> [9]; неразобранное -> []."""
    text = norm_text(raw).lower()
    if not text:
        return []
    names = [p.strip() for p in re.split(r'[-–—,]', text) if p.strip()]
    resolved = [MONTHS_RU[n] for n in names if n in MONTHS_RU]
    if len(resolved) == 2 and re.search(r'[-–—]', text):
        start, end = resolved
        if start <= end:
            return list(range(start, end + 1))
    return resolved


def parse_r_codes(raw):
    """Разбирает 'Функ. кл.: 03 12 00 039 Экон. кл.: 1 10 10 99 Прог. кл.: 099 00 Ведом. кл.: 055'
    на 4 нормализованных кода-строки (или None, если группа не найдена)."""
    text = norm_text(raw)
    func = RE_FUNC_CODE.search(text)
    econ = RE_ECON_CODE.search(text)
    prog = RE_PROG_CODE.search(text)
    ved = RE_VED_CODE.search(text)
    return (
        norm_text(func.group(1)) if func else None,
        norm_text(econ.group(1)) if econ else None,
        norm_text(prog.group(1)) if prog else None,
        norm_text(ved.group(1)) if ved else None,
    )


def classify_row(num_raw):
    """Определяет категорию строки по тексту в колонке num (G). None = обычная позиция
    с настоящим номером — ищем как раньше, точным совпадением."""
    text = num_raw.lower()
    if 'административная процедур' in text:
        return 'ADMIN_PAYMENT'
    if 'свободный платеж' in text:
        return 'FREE_PAYMENT'
    if text.startswith('не публ') or text.startswith('не план'):
        return 'NONPUBLIC'
    if text.startswith('многолетняя закупка') or text.startswith('позиция '):
        return 'CARRYOVER'
    return None


def extract_source_year(num_raw):
    """Год ИЗ КОТОРОГО переходит позиция (для CARRYOVER). "Многолетняя закупка" в этом
    файле всегда означает договор 2025 года (см. формулировку пользователя)."""
    text = num_raw.lower()
    if text.startswith('многолетняя закупка'):
        return 2025
    m = RE_SOURCE_YEAR.search(text)
    return int(m.group(1)) if m else None


class DepartmentResolver:
    """
    Сопоставляет сырое значение колонки Department со справочником Department.
    Правила зафиксированы по итогам разбора с пользователем (см. CurrentStatus.md):
      - точное совпадение / совпадение после нормализации пробелов-регистра;
      - алиасы вида "гл.мед.сестра" -> "Жабенко" (см. DEPT_ALIASES);
      - суффикс "X УТО ..." -> базовый код X (актуально для колонки W, "для кого закупка");
      - несколько подразделений через запятую/слэш -> комбинация (актуально только для W).
    """

    def __init__(self):
        self.by_norm = {norm_text(d.short_name).lower(): d for d in Department.objects.all()}

    def resolve_one(self, raw):
        """Одно подразделение (без запятых). Возвращает Department или None."""
        norm = norm_text(raw)
        if not norm:
            return None
        key = DEPT_ALIASES.get(norm.lower(), norm.lower())
        dept = self.by_norm.get(key)
        if dept:
            return dept
        stripped = norm_text(DEPT_SUFFIX_RE.sub('', norm))
        return self.by_norm.get(stripped.lower())

    def resolve(self, raw):
        """
        Возвращает (department, is_combo, raw_parts) — используется для W (бенефициары):
          - если ячейка содержит несколько подразделений через запятую/слэш — is_combo=True;
          - иначе department = сопоставленное подразделение или None.
        """
        norm = norm_text(raw)
        if not norm:
            return None, False, []
        if ',' in norm or '/' in norm:
            parts = [norm_text(p) for p in re.split(r'[,/]', norm) if norm_text(p)]
            return None, True, parts
        return self.resolve_one(norm), False, [norm]


class Command(BaseCommand):
    help = 'Перенос листа "реестр 26" из rd26.xlsx: PlanShare, Contract/ContractItem, TreasuryPayment, квартальное финансирование.'

    def add_arguments(self, parser):
        parser.add_argument('--file', type=str, default=None,
                            help='Путь к rd26.xlsx (по умолчанию input/rd26.xlsx в корне репозитория)')
        parser.add_argument('--apply', action='store_true',
                            help='Реально сохранить изменения. Без флага — только отчёт (dry-run).')

    def handle(self, *args, **options):
        file_path = options['file'] or str(settings.BASE_DIR.parent / 'input' / 'rd26.xlsx')
        apply_changes = options['apply']

        self.stdout.write(f'Открываю {file_path} ...')
        # read_only=True — критично для производительности: файл реестра содержит форматирование,
        # растянутое на тысячи лишних столбцов (используется до BD=56, но max_col доходил до 16366),
        # из-за чего обычная загрузка openpyxl строит полное дерево стилей и раздувается в память
        # (замечено >2 ГБ и продолжало расти). read_only-режим читает ячейки потоково и не страдает
        # от этого.
        wb = openpyxl.load_workbook(file_path, data_only=True, read_only=True)
        if SHEET_NAME not in wb.sheetnames:
            self.stderr.write(self.style.ERROR(f'Лист "{SHEET_NAME}" не найден. Есть: {wb.sheetnames}'))
            return
        ws = wb[SHEET_NAME]

        # ВАЖНО: в read_only-режиме произвольный доступ ws.cell(row, column) — потоковый парсер,
        # каждый вызов заново идёт по XML от текущей позиции. На файле с раздутым форматированием
        # (см. выше) это даёт ~30 мс на ОДНУ ячейку — при ~40 полях на строку и ~1700 строках это
        # час с лишним. Поэтому читаем весь лист ОДИН раз последовательно (iter_rows — быстрый,
        # <1 сек на весь файл) и дальше работаем с уже загруженными в память кортежами значений.
        self.stdout.write('Читаю строки листа (последовательно, разово)...')
        row_values = {
            idx: values for idx, values in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2)
        }
        max_row = max(row_values.keys()) if row_values else 1

        def cell_value(row_idx, col):
            values = row_values.get(row_idx)
            if not values or col - 1 >= len(values):
                return None
            return values[col - 1]

        dept_resolver = DepartmentResolver()
        buyer_cache = {norm_text(b.shot_name).lower(): b for b in Buyer.objects.all()}
        iec_cache = {c.code: c for c in InternalEconomicClassifier.objects.all()}
        okrb_cache = {p.code: p for p in OkrbProduct.objects.all()}
        unit_cache = {norm_text(u.short_name).lower(): u for u in UnitOfMeasurement.objects.all()}
        func_cache = {c.code_api: c for c in FunctionalCode.objects.all()}
        econ_cache = {c.code_api: c for c in ExternalEconomicCode.objects.all()}
        prog_cache = {c.code_api: c for c in ProgramCode.objects.all()}
        purchases_by_year = {p.year: p for p in Purchases.objects.all()}
        kind_admin, _ = KindOfPayment.objects.get_or_create(name='Административные процедуры')
        kind_free, _ = KindOfPayment.objects.get_or_create(name='Свободный платеж')
        # Платежи по переходящим позициям (CARRYOVER) — "перенос" факта из колонок AW/AY/BA/BC
        # реестра прошлых лет в оплату текущего года. Решение пользователя 2026-10-26: отдельный
        # вид платежа (не "Административные процедуры"/"Свободный платёж" — у этих строк ЕСТЬ
        # договор и позиция плана), дата платежа = начало соответствующего квартала года оплаты
        # (точного дня реестр не даёт), что сохраняет поквартальную аналитику и не мешает в
        # будущем проводить обычные платёжки по этому же договору.
        kind_carryover, _ = KindOfPayment.objects.get_or_create(name='Платеж-перенос из файла')
        # Обычные позиции (не переходящие) — раньше квартальный факт писался ТОЛЬКО в
        # ContractQuarterlyFinance, без зеркальной TreasuryPayment. Это ломало цепочку отчётности
        # "факт по статье/держателю лимита" (решение пользователя 2026-10-30: эта аналитика должна
        # строиться из платёжек, а не из ContractQuarterlyFinance). Добавлено зеркалирование
        # каждого ненулевого квартального факта в TreasuryPayment для ВСЕХ категорий строк, не
        # только CARRYOVER — используем ТОТ ЖЕ самый вид платежа kind_carryover (решение
        # пользователя 2026-10-30: не плодить лишние виды платежей — всё из файла одного
        # переноса логично помечать одним видом).
        # Отрицательные квартальные корректировки (переплата квартала N, скорректированная в
        # квартале N+1 отрицательной суммой) нельзя записать в TreasuryPayment напрямую —
        # amount там строго положительный. Решение пользователя 2026-10-30: заводим в модели
        # KindOfPayment признак is_refund (платёж уменьшает факт расхода, а не увеличивает) и
        # записываем такую корректировку положительной суммой с этим видом платежа — то же
        # относится и к "Восстановлению кассовых расходов", если оно понадобится отдельно позже.
        kind_refund, _ = KindOfPayment.objects.get_or_create(
            name='Возврат (из файла реестра)', defaults={'is_refund': True},
        )
        if not kind_refund.is_refund:  # на случай повторного запуска после ручного создания записи
            kind_refund.is_refund = True
            kind_refund.save(update_fields=['is_refund'])

        # --- идемпотентность непубликуемых позиций между повторными --apply (см. docstring) ---
        # Было: сопоставление по ПОРЯДКОВОМУ номеру строки среди себе подобных ("1-я такая
        # строка в файле -> 1-я созданная запись" и т.д.). Сломалось на практике 2026-10-26:
        # состав/порядок строк блока "Оборон заказ" изменился с сентября (как минимум одна
        # позиция — "5,6 мм пистолет" — пропала из файла целиком), из-за чего все последующие
        # строки сопоставлялись с ЧУЖИМИ записями БД (напр. "наручники" сравнивалась с лимитом
        # позиции "5,6 мм пистолет"), давая ложные "превышение лимита". См. CurrentStatus.md,
        # Проход 6.
        # Теперь — сопоставление по содержимому: ключ (год, нормализованное название, val_amount).
        # Этого достаточно почти всегда (нашлась ровно одна пара строк с полностью идентичными
        # название+количество — для неё остаётся сопоставление по порядку ВНУТРИ этой пары,
        # что безопасно: при перестановке местами результат не меняется, т.к. у обеих val_amount
        # совпадает).
        existing_non_public_by_key = defaultdict(list)
        for pi in PlanItem.objects.filter(is_public=False).select_related('plan_purchase'):
            detail = pi.details.filter(status=PlanItemStatus.ACTIVE).first() or pi.details.order_by('-id').first()
            if not detail:
                continue
            year_ = pi.plan_purchase.year if pi.plan_purchase else None
            budget_cost = pi.budget_costs.filter(year=year_, status=PlanItemStatus.ACTIVE).first() if year_ else None
            key = (year_, norm_text(detail.title).lower(), detail.val_amount)
            existing_non_public_by_key[key].append((pi, detail, budget_cost))
        for key in existing_non_public_by_key:
            existing_non_public_by_key[key].sort(key=lambda t: t[0].id)
        non_public_seen_count = {}  # ключ (год, название, количество) -> сколько раз уже встречено

        # --- идемпотентность платёжек без плана между повторными --apply ---
        existing_payments_by_kind = {
            kind_admin.pk: list(TreasuryPayment.objects.filter(kind=kind_admin).order_by('id')),
            kind_free.pk: list(TreasuryPayment.objects.filter(kind=kind_free).order_by('id')),
            kind_carryover.pk: list(TreasuryPayment.objects.filter(kind=kind_carryover).order_by('id')),
            kind_refund.pk: list(TreasuryPayment.objects.filter(kind=kind_refund).order_by('id')),
        }
        payment_seen_count = {}

        # --- кэш кандидатов для нечёткого сопоставления переходящих позиций (по годам) ---
        carryover_candidates_cache = {}

        stats = {
            'rows_total': 0,
            'plan_item_not_found': [],
            'detail_not_found': [],
            'budget_cost_not_found': [],
            'internal_code_not_found': [],
            'internal_code_set': 0,
            'dept_unresolved': [],
            'beneficiary_unresolved': [],
            'plan_share_created': 0,
            'plan_share_updated': 0,
            'contract_created': 0,
            'contract_item_created': 0,
            'quarter_rows_written': 0,
            'supplier_created': 0,
            'delivery_date_fallback': [],
            'row_errors': [],
            'non_public_created': [],
            'non_public_no_purchases': [],
            'payments_created': 0,
            'payments_created_by_kind': {},
            'carryover_matched': [],
            'carryover_fallback_created': [],
            'carryover_unmatched': [],
            'carryover_year_unparsed': [],
            'carryover_budgetcost_created': 0,
        }
        touched_contract_ids = set()

        # ------------------------------------------------------------------
        # Общие справочные хелперы (get_or_create для кодов, которых нет на goszakupki.by)
        # ------------------------------------------------------------------
        def get_or_create_okrb(code, title):
            code = norm_text(code)
            if not code:
                return None
            okrb = okrb_cache.get(code)
            if not okrb:
                okrb = OkrbProduct.objects.create(code=code, title=norm_text(title) or code)
                okrb_cache[code] = okrb
            return okrb

        def get_or_create_unit(short_name):
            key = norm_text(short_name).lower()
            if not key:
                return None
            unit = unit_cache.get(key)
            if not unit:
                temp_code = f'X{abs(hash(key)) % 10 ** 7:07d}'  # код ОКРБ008 неизвестен — временный
                unit = UnitOfMeasurement.objects.create(code=temp_code, short_name=norm_text(short_name))
                unit_cache[key] = unit
            return unit

        def get_or_create_func(code_api):
            if not code_api:
                return None
            fc = func_cache.get(code_api)
            if not fc:
                fc = FunctionalCode.objects.create(code_api=code_api, description='(добавлено при переносе реестра)')
                func_cache[code_api] = fc
            return fc

        def get_or_create_econ(code_api):
            if not code_api:
                return None
            ec = econ_cache.get(code_api)
            if not ec:
                ec = ExternalEconomicCode.objects.create(code_api=code_api, description='(добавлено при переносе реестра)')
                econ_cache[code_api] = ec
            return ec

        def get_or_create_prog(code_api):
            if not code_api:
                return None
            pc = prog_cache.get(code_api)
            if not pc:
                pc = ProgramCode.objects.create(code_api=code_api, description='(добавлено при переносе реестра)')
                prog_cache[code_api] = pc
            return pc

        def build_internal_code(row_idx):
            """Склеивает D (суффикс) + E (статья) во внутренний код ЭКР.
            Особый случай (подтверждён специалистом, см. answer_fin.txt, Раздел 3,
            код "2400300300000", 31 строка): суффикс "300000" — не настоящий код, а хак
            для уникальности строк в сводных таблицах Excel; реальный код получается
            заменой этого суффикса на "000" (статья "2400300" + "000" = "2400300000")."""
            suffix = cell_value(row_idx, COL_ECON_SUFFIX)
            article = cell_value(row_idx, COL_ARTICLE)
            if suffix is None or article is None:
                return None, None
            suffix_str = str(suffix).strip()
            if suffix_str == '300000':
                suffix_str = '000'
            full_code = f'{str(article).strip()}{suffix_str}'
            return full_code, iec_cache.get(full_code)

        def classify_codes_from_row(row_idx):
            """(internal_code, functional, economic, program) — объекты справочников по строке."""
            _, internal_code = build_internal_code(row_idx)
            func_code, econ_code, prog_code, ved_code = parse_r_codes(cell_value(row_idx, COL_R_CODES))
            return internal_code, get_or_create_func(func_code), get_or_create_econ(econ_code), get_or_create_prog(prog_code), ved_code

        def select_budget_cost(row_idx, plan_item, year):
            """Выбирает нужную строку бюджета среди (возможно нескольких) ACTIVE BudgetCosts
            одной позиции плана на один год. Одна позиция плана может законно иметь НЕСКОЛЬКО
            строк бюджета на один год одновременно — оплата по разным статьям ЭКР за разные
            части одной закупки (подтверждено пользователем и данными БД при разборе
            answer_fin.txt, Раздел 4 — см. CurrentStatus.md, Проход 10: баг в
            BudgetCostsImportSerializer архивировал такие строки друг в друга, т.к. ключ
            идентичности не учитывал economic_code; исправлено отдельно).
            Сопоставляет по economic_class (внешний код ЭКР, колонка R) конкретной строки
            реестра; если код в R не распознан или однозначного совпадения нет — откатывается
            на первую запись (поведение как раньше, до фикса)."""
            if not year:
                return None
            candidates = list(plan_item.budget_costs.filter(year=year, status=PlanItemStatus.ACTIVE))
            if len(candidates) <= 1:
                return candidates[0] if candidates else None
            _, econ_code, _, _ = parse_r_codes(cell_value(row_idx, COL_R_CODES))
            if econ_code:
                econ_obj = econ_cache.get(econ_code)
                if econ_obj:
                    matched = [c for c in candidates if c.economic_class_id == econ_obj.id]
                    if len(matched) == 1:
                        return matched[0]
            return candidates[0]

        def create_budget_cost_for_item(row_idx, plan_item, year):
            """BudgetCosts(year), которого нет ни в синхронизации с порталом, ни в БД —
            для непубликуемых позиций и для переходящих (см. CARRYOVER — портал не публикует
            перенос финансирования на новый год для этих позиций)."""
            internal_code, functional_class, economic_class, program_class, ved_code = classify_codes_from_row(row_idx)
            cost = to_decimal(cell_value(row_idx, COL_COST)) \
                or to_decimal(cell_value(row_idx, COL_PERV_SUM)) or Decimal('0')
            return BudgetCosts.objects.create(
                plan_item=plan_item, status=PlanItemStatus.ACTIVE,
                purchases_items_id=0,  # официального id с портала для таких позиций не существует
                cost=cost, year=year,
                functional_class=functional_class, department_code=ved_code,
                economic_class=economic_class, program_class=program_class,
                internal_economic_class=internal_code,
            )

        def create_non_public_plan_item(row_idx, year):
            """
            Создаёт PlanItem(is_public=False) + PlanItemDetail + BudgetCosts прямо из строки
            реестра — для категории NONPUBLIC. num генерируется моделью автоматически
            (ClosedPlanSequence), см. PlanItem.save(). Идемпотентно между запусками —
            сопоставление по (год, название, количество), см. existing_non_public_by_key
            и комментарий там же (почему не по порядковому номеру строки).
            """
            purchases = purchases_by_year.get(year)
            if not purchases:
                stats['non_public_no_purchases'].append((row_idx, year))
                return None

            title = norm_text(cell_value(row_idx, COL_TITLE))
            amount = to_decimal(cell_value(row_idx, COL_AMOUNT), decimal_places=3) or Decimal('0')

            key = (year, title.lower(), amount)
            ordinal = non_public_seen_count.get(key, 0)
            non_public_seen_count[key] = ordinal + 1
            already = existing_non_public_by_key.get(key, [])
            if ordinal < len(already):
                plan_item, plan_detail, budget_cost = already[ordinal]
                if not budget_cost:
                    budget_cost = plan_item.budget_costs.filter(year=year, status=PlanItemStatus.ACTIVE).first()
                if plan_detail and budget_cost:
                    return plan_item, plan_detail, budget_cost
                # Не нашли деталей у "уже существующей" позиции — безопаснее создать новую.

            plan_item = PlanItem(plan_purchase=purchases, is_public=False, is_active=True)
            plan_item.save()  # присвоит num вида "{год}-INTERNAL-NNNNN"

            okrb_code = cell_value(row_idx, COL_OKRB_CODE)
            okrb_title = cell_value(row_idx, COL_OKRB_TITLE)
            kind = norm_text(cell_value(row_idx, COL_KIND)).lower()
            item_type = ProcurementItemTypes.product if 'товар' in kind else ProcurementItemTypes.job
            unit = get_or_create_unit(cell_value(row_idx, COL_UNIT))
            fund_cost = to_decimal(cell_value(row_idx, COL_FUND_COST)) or Decimal('0')
            inner_cost = to_decimal(cell_value(row_idx, COL_INNER_COST)) or Decimal('0')
            months = parse_procedure_months(cell_value(row_idx, COL_PROC_MONTH))

            plan_detail = PlanItemDetail.objects.create(
                plan_item=plan_item, status=PlanItemStatus.ACTIVE,
                unp_budget=settings.UNP_BUDGET, num=plan_item.num,
                title=title or '(без наименования, см. реестр)',
                okrb=norm_text(okrb_code), okrb_title=norm_text(okrb_title) or title,
                okrb_product=get_or_create_okrb(okrb_code, okrb_title),
                # val_type — код ОКРБ 008 (единицы измерения), а не ОКРБ 007 (продукция);
                # реестр даёт только текст единицы, поэтому берём код уже сопоставленной/
                # созданной UnitOfMeasurement.
                type=item_type, val_amount=amount, val_type=unit.code if unit else '',
                val_unit=unit, fund_cost=fund_cost, inner_cost=inner_cost,
                procedure_months=months,
            )
            budget_cost = create_budget_cost_for_item(row_idx, plan_item, year)
            stats['non_public_created'].append((row_idx, plan_item.num, title[:60]))
            return plan_item, plan_detail, budget_cost

        def find_carryover_match(source_year, title, okrb):
            """Нечёткий поиск позиции среди плана source_year по названию+ОКРБ.
            Возвращает (PlanItem|None, score)."""
            if source_year not in carryover_candidates_cache:
                carryover_candidates_cache[source_year] = list(
                    PlanItemDetail.objects.filter(
                        plan_item__plan_purchase__year=source_year, plan_item__is_active=True,
                    ).select_related('plan_item')
                )
            candidates = carryover_candidates_cache[source_year]
            title_l = title.lower()
            best, best_score = None, 0.0
            for c in candidates:
                title_ratio = difflib.SequenceMatcher(None, title_l, (c.title or '').lower()).ratio()
                okrb_match = 1.0 if okrb and c.okrb == okrb else 0.0
                score = title_ratio * 0.7 + okrb_match * 0.3
                if score > best_score:
                    best_score = score
                    best = c
            if best and best_score >= CARRYOVER_MATCH_THRESHOLD:
                return best.plan_item, best_score
            return None, best_score

        def make_treasury_payment(kind, contract, amount, payment_date, notice,
                                  internal_code=None, functional_class=None, economic_class=None,
                                  program_class=None, departments=()):
            """Общее идемпотентное создание TreasuryPayment: сопоставление по порядку записей
            ЭТОГО вида платежа между повторными запусками --apply (см. docstring модуля,
            existing_payments_by_kind/payment_seen_count) — реестр не даёт платежам устойчивого
            идентификатора. departments — подразделения для оперативного учёта (поле добавлено
            2026-10-26, см. модель TreasuryPayment)."""
            already = existing_payments_by_kind.setdefault(kind.pk, [])
            ordinal = payment_seen_count.get(kind.pk, 0)
            payment_seen_count[kind.pk] = ordinal + 1
            if ordinal < len(already):
                return already[ordinal]  # уже создано в предыдущем запуске --apply
            payment = TreasuryPayment.objects.create(
                contract=contract, payment_date=payment_date, save_date=payment_date,
                amount=amount, kind=kind, notice=notice[:1024],
                internal_economic_class=internal_code, economic_class=economic_class,
                functional_class=functional_class, program_class=program_class,
            )
            if departments:
                payment.departments.set([d for d in departments if d])
            stats['payments_created'] += 1
            stats['payments_created_by_kind'][kind.name] = stats['payments_created_by_kind'].get(kind.name, 0) + 1
            return payment

        def create_payments_from_row(row_idx, kind, year):
            """Категории ADMIN_PAYMENT/FREE_PAYMENT: без позиции плана, только факт расхода.
            Одна TreasuryPayment на каждый квартал с ненулевым фактом; если разбивки по
            кварталам нет вообще — одна платёжка на сумму AB (Текущая сумма договора) с
            датой на конец года. Идемпотентно между запусками (см. docstring модуля)."""
            contract_num = norm_text(cell_value(row_idx, COL_CONTRACT_NUM))
            contract = None
            if contract_num:
                contract_date_val = cell_value(row_idx, COL_CONTRACT_DATE)
                contract_date = contract_date_val.date() if hasattr(contract_date_val, 'date') else None
                supplier_name = norm_text(cell_value(row_idx, COL_SUPPLIER))
                supplier = None
                if supplier_name:
                    supplier = Supplier.objects.filter(name__iexact=supplier_name).first()
                    if not supplier:
                        supplier = Supplier.objects.create(name=supplier_name, unp=None)
                        stats['supplier_created'] += 1
                contract = Contract.objects.filter(number=contract_num, contract_date=contract_date).first()
                if not contract and supplier and contract_date:
                    delivery_date = cell_value(row_idx, COL_DELIVERY_DATE)
                    delivery_date = delivery_date.date() if hasattr(delivery_date, 'date') else contract_date
                    is_registered = norm_text(cell_value(row_idx, COL_IS_REGISTERED_TK)) == '+'
                    payment_terms = norm_text(cell_value(row_idx, COL_PAYMENT_TERMS)) or None
                    contract = Contract.objects.create(
                        number=contract_num, contract_date=contract_date, supplier=supplier,
                        total_cost=to_decimal(cell_value(row_idx, COL_CONTRACT_ROW_COST)) or Decimal('0'),
                        is_registered_in_treasury=is_registered, payment_terms=payment_terms,
                        planned_delivery_date=delivery_date,
                    )
                    stats['contract_created'] += 1
                    touched_contract_ids.add(contract.pk)

            title = norm_text(cell_value(row_idx, COL_TITLE))
            buyer_raw = norm_text(cell_value(row_idx, COL_BUYER))
            al = norm_text(cell_value(row_idx, COL_WORKS_AL))
            aq = norm_text(cell_value(row_idx, COL_PLAN_NUM_AQ))
            ak = norm_text(cell_value(row_idx, COL_CATEGORY_AK))
            aa = norm_text(cell_value(row_idx, COL_SUPPLIER))

            notice_parts = [title, buyer_raw]
            if kind.pk == kind_free.pk and aa:  # для свободного платежа — ещё и поставщик
                notice_parts.append(aa)
            notice_parts += [p for p in (al, aq, ak) if p]
            notice = ' | '.join(p for p in notice_parts if p)[:1024]

            internal_code, functional_class, economic_class, program_class, _ = classify_codes_from_row(row_idx)
            if not internal_code:
                full_code, _ = build_internal_code(row_idx)
                if full_code:
                    stats['internal_code_not_found'].append((row_idx, norm_text(cell_value(row_idx, COL_NUM)), full_code))

            # --- бенефициары (W) -> TreasuryPayment.departments (решение пользователя 2026-10-26:
            # эти строки без позиции плана/PlanShare, писать беневициаров больше некуда) ---
            dept_beneficiary_raw = cell_value(row_idx, COL_DEPT_BENEFICIARY)
            _, _, beneficiary_parts = dept_resolver.resolve(dept_beneficiary_raw)
            payment_departments = []
            for part in beneficiary_parts:
                d = dept_resolver.resolve_one(part)
                if d:
                    payment_departments.append(d)
                elif part:
                    stats['beneficiary_unresolved'].append((row_idx, norm_text(cell_value(row_idx, COL_NUM)), part))

            def make_payment(amount, payment_date, extra_notice=''):
                make_treasury_payment(
                    kind, contract, amount, payment_date, notice + extra_notice,
                    internal_code=internal_code, functional_class=functional_class,
                    economic_class=economic_class, program_class=program_class,
                    departments=payment_departments,
                )

            any_quarter = False
            for quarter, fin_col, due_col in QUARTER_COLS:
                fin = to_decimal(cell_value(row_idx, fin_col))
                if not fin or fin <= 0:
                    continue
                any_quarter = True
                month, day = QUARTER_END_DATE[quarter]
                make_payment(fin, datetime.date(year, month, day))

            if not any_quarter:
                total = to_decimal(cell_value(row_idx, COL_CONTRACT_ROW_COST)) or Decimal('0')
                if total > 0:
                    make_payment(total, datetime.date(year, 12, 31), extra_notice=' [без разбивки по кварталам]')

        # ------------------------------------------------------------------
        # Обработка одной строки
        # ------------------------------------------------------------------
        def process_row(row_idx, num):
            """Вся логика одной строки реестра. Исключения ловит вызывающий код (свой savepoint)."""
            year = cell_value(row_idx, COL_YEAR)
            try:
                year = int(year)
            except (TypeError, ValueError):
                year = None

            category = classify_row(num)

            if category == 'ADMIN_PAYMENT':
                if year:
                    create_payments_from_row(row_idx, kind_admin, year)
                return
            if category == 'FREE_PAYMENT':
                if year:
                    create_payments_from_row(row_idx, kind_free, year)
                return

            plan_item = plan_detail = budget_cost = None

            if category == 'NONPUBLIC':
                created = create_non_public_plan_item(row_idx, year) if year else None
                if not created:
                    return
                plan_item, plan_detail, budget_cost = created

            elif category == 'CARRYOVER':
                source_year = extract_source_year(num)
                if not source_year:
                    stats['carryover_year_unparsed'].append((row_idx, num))
                    return
                title = norm_text(cell_value(row_idx, COL_TITLE))
                okrb = norm_text(cell_value(row_idx, COL_OKRB_CODE))
                override_num = CARRYOVER_OVERRIDES.get((source_year, title.lower(), okrb))
                if override_num:
                    matched_item = PlanItem.objects.filter(num=override_num).first()
                    score = 1.0
                else:
                    matched_item, score = find_carryover_match(source_year, title, okrb)
                if matched_item:
                    stats['carryover_matched'].append((row_idx, num, matched_item.num, round(score, 2)))
                    plan_item = matched_item
                else:
                    # Уверенного совпадения среди опубликованных позиций source_year нет —
                    # создаём "якорную" непубликуемую позицию ЭТОГО прошлого года (решение
                    # пользователя, 2026-10-26), дальше строка обрабатывается как обычная
                    # переходящая (PlanShare/Contract/ContractQuarterlyFinance/платёж-перенос).
                    created = create_non_public_plan_item(row_idx, source_year)
                    if not created:
                        stats['carryover_unmatched'].append((row_idx, num, title[:70], round(score, 2)))
                        return
                    plan_item, plan_detail, _ = created
                    stats['carryover_fallback_created'].append((row_idx, num, plan_item.num, round(score, 2)))

                budget_cost = select_budget_cost(row_idx, plan_item, year)
                if not budget_cost and year:
                    budget_cost = create_budget_cost_for_item(row_idx, plan_item, year)
                    stats['carryover_budgetcost_created'] += 1

            else:
                plan_item = PlanItem.objects.filter(num=num).first()
                if not plan_item:
                    stats['plan_item_not_found'].append((row_idx, num))
                    return

            if not plan_detail:
                plan_detail = plan_item.details.filter(status=PlanItemStatus.ACTIVE).first() \
                    or plan_item.details.order_by('-id').first()
            if not plan_detail:
                stats['detail_not_found'].append((row_idx, num))
                return

            if not budget_cost:
                budget_cost = select_budget_cost(row_idx, plan_item, year)
            if not budget_cost:
                stats['budget_cost_not_found'].append((row_idx, num, year))
                return

            # --- внутренний код ЭКР (D+E), если ещё не проставлен ---
            if not budget_cost.internal_economic_class_id:
                full_code, iec = build_internal_code(row_idx)
                if full_code:
                    if iec:
                        budget_cost.internal_economic_class = iec
                        budget_cost.save()  # save() сам проставит section/subsection/kind
                        stats['internal_code_set'] += 1
                    else:
                        stats['internal_code_not_found'].append((row_idx, num, full_code))

            # --- закупщик ---
            buyer_raw = norm_text(cell_value(row_idx, COL_BUYER))
            if buyer_raw and not plan_detail.buyer_id:
                buyer = buyer_cache.get(buyer_raw.lower())
                if buyer:
                    plan_detail.buyer = buyer
                    plan_detail.save(update_fields=['buyer'])

            # --- держатель лимита (V) -> PlanShare; однозначно, комбинаций больше нет ---
            dept_holder_raw = cell_value(row_idx, COL_DEPT_HOLDER)
            department = dept_resolver.resolve_one(dept_holder_raw)
            if not department:
                stats['dept_unresolved'].append((row_idx, num, dept_holder_raw))
                return

            # --- бенефициары (W) -> beneficiary_departments; не блокирует PlanShare ---
            dept_beneficiary_raw = cell_value(row_idx, COL_DEPT_BENEFICIARY)
            _, _, beneficiary_parts = dept_resolver.resolve(dept_beneficiary_raw)
            for part in beneficiary_parts:
                d = dept_resolver.resolve_one(part)
                if d:
                    plan_detail.beneficiary_departments.add(d)
                elif part:
                    stats['beneficiary_unresolved'].append((row_idx, num, part))

            amount = to_decimal(cell_value(row_idx, COL_AMOUNT), decimal_places=3) or Decimal('0')
            cost = to_decimal(cell_value(row_idx, COL_COST)) or Decimal('0')

            plan_share, ps_created = PlanShare.objects.get_or_create(
                budget_cost=budget_cost, department=department,
                defaults={'shared_amount': amount, 'shared_cost': cost},
            )
            if ps_created:
                stats['plan_share_created'] += 1
            elif plan_share.shared_amount != amount or plan_share.shared_cost != cost:
                plan_share.shared_amount = amount
                plan_share.shared_cost = cost
                plan_share.save()
                stats['plan_share_updated'] += 1

            # --- договор / строка договора ---
            contract_num = norm_text(cell_value(row_idx, COL_CONTRACT_NUM))
            if not contract_num:
                return

            contract_date_val = cell_value(row_idx, COL_CONTRACT_DATE)
            contract_date = contract_date_val.date() if hasattr(contract_date_val, 'date') else None
            supplier_name = norm_text(cell_value(row_idx, COL_SUPPLIER))

            supplier = None
            if supplier_name:
                supplier = Supplier.objects.filter(name__iexact=supplier_name).first()
                if not supplier:
                    supplier = Supplier.objects.create(name=supplier_name, unp=None)
                    stats['supplier_created'] += 1

            contract = Contract.objects.filter(number=contract_num, contract_date=contract_date).first()
            if not contract and supplier and contract_date:
                delivery_date = cell_value(row_idx, COL_DELIVERY_DATE)
                delivery_date = delivery_date.date() if hasattr(delivery_date, 'date') else None
                if not delivery_date:
                    delivery_date = contract_date
                    stats['delivery_date_fallback'].append((row_idx, num, contract_num))
                is_registered = norm_text(cell_value(row_idx, COL_IS_REGISTERED_TK)) == '+'
                payment_terms = norm_text(cell_value(row_idx, COL_PAYMENT_TERMS)) or None
                contract = Contract.objects.create(
                    number=contract_num, contract_date=contract_date, supplier=supplier,
                    total_cost=Decimal('0'), is_registered_in_treasury=is_registered,
                    payment_terms=payment_terms, planned_delivery_date=delivery_date,
                )
                stats['contract_created'] += 1
                touched_contract_ids.add(contract.pk)

            if not (contract and contract.pk and plan_share.pk):
                return

            row_cost = to_decimal(cell_value(row_idx, COL_CONTRACT_ROW_COST)) or cost
            # Ключ (plan_share, contract), а НЕ просто plan_share: у одной позиции плана для
            # одного подразделения бывает несколько РАЗНЫХ договоров (см. ТЗ и пример
            # 2026-102377498-66 — 14 отдельных договоров на охрану от разных отделов Департамента
            # охраны МВД под одним и тем же ООиОЗ). При ключе только по plan_share вторая и
            # последующие строки "прилипали" бы к первому найденному ContractItem чужого договора.
            contract_item, ci_created = ContractItem.objects.get_or_create(
                plan_share=plan_share, contract=contract,
                defaults={
                    'title': plan_detail.title[:2048] if plan_detail.title else None,
                    'year': year, 'contract_amount': amount, 'contract_cost': row_cost,
                },
            )
            if ci_created:
                stats['contract_item_created'] += 1
                touched_contract_ids.add(contract.pk)
                # Пересчитываем total_cost СРАЗУ (не в конце) — ContractQuarterlyFinance.clean()
                # валидирует actual_cost <= contract.total_cost, а до этой строки договор
                # мог быть создан с total_cost=0 (см. создание Contract выше).
                contract.total_cost = sum((ci.contract_cost for ci in contract.items.all()), Decimal('0'))
                Contract.objects.filter(pk=contract.pk).update(total_cost=contract.total_cost)

            # Собираем значения по кварталам ЭТОЙ строки и пишем в порядке возрастания факта
            # (отрицательные корректировки — раньше крупных сумм, которые они корректируют),
            # а не по календарному кварталу. ContractQuarterlyFinance.clean() проверяет
            # НАКОПЛЕННЫЙ факт по договору/строке договора — при обычном порядке Q1..Q4
            # промежуточная запись переплаты (напр. Q2) могла бы сама по себе "превысить"
            # сумму договора ДО того, как будет записана корректировка следующего квартала
            # (см. CurrentStatus.md, Проход 11 — договор "1214-ти/3": Q2=30518.55,
            # Q3=-5821.47, итог за год точно равен сумме договора). Для обычных строк без
            # отрицательных корректировок порядок записи не влияет на результат.
            quarter_values = []
            for quarter, fin_col, due_col in QUARTER_COLS:
                fin = to_decimal(cell_value(row_idx, fin_col))
                due = to_decimal(cell_value(row_idx, due_col))
                if fin is None and due is None:
                    continue
                quarter_values.append((quarter, fin or Decimal('0'), due))

            for quarter, actual, due in sorted(quarter_values, key=lambda t: t[1]):
                planned = actual + (due or Decimal('0'))
                ContractQuarterlyFinance.objects.update_or_create(
                    contract=contract, contract_item=contract_item, quarter=quarter, year=year,
                    defaults={'planned_cost': planned, 'actual_cost': actual},
                )
                stats['quarter_rows_written'] += 1

                # --- зеркалим факт в TreasuryPayment (решение пользователя 2026-10-30) ---
                # Раньше это делалось ТОЛЬКО для CARRYOVER; для обычных позиций факт оставался
                # исключительно в ContractQuarterlyFinance, а отчётность "факт по статье/
                # держателю лимита" договорились строить из платёжек — цепочка не доходила до
                # последнего звена. Теперь — для всех категорий. Дата — начало квартала (точного
                # дня реестр не даёт), departments — держатель лимита этой строки (денормализация
                # для оперативного учёта). amount в TreasuryPayment строго положительный —
                # отрицательная корректировка квартала (переплата, скорректированная позже)
                # записывается положительной суммой с видом платежа kind_refund
                # (KindOfPayment.is_refund=True — уменьшает факт расхода, а не увеличивает).
                if actual == 0:
                    continue
                row_title = title if category == 'CARRYOVER' else (plan_detail.title or '')
                month, day = QUARTER_START_DATE[quarter]
                if actual > 0:
                    kind = kind_carryover
                    notice = f'{row_title} | перенос из {num}' if category == 'CARRYOVER' else f'{row_title} | {num}'
                    pay_amount = actual
                else:
                    kind = kind_refund
                    notice = f'{row_title} | возврат/корректировка | {num}'
                    pay_amount = -actual
                make_treasury_payment(
                    kind, contract, pay_amount, datetime.date(year, month, day), notice,
                    internal_code=budget_cost.internal_economic_class,
                    departments=[department],
                )

        with transaction.atomic():
            for row_idx in range(2, max_row + 1):
                num = cell_value(row_idx, COL_NUM)
                if not num or not str(num).strip():
                    continue
                num = str(num).strip()
                stats['rows_total'] += 1

                try:
                    with transaction.atomic():  # savepoint: одна строка не роняет весь импорт
                        process_row(row_idx, num)
                except Exception as exc:  # noqa: BLE001 — данные "грязные", ловим любой сбой построчно
                    stats['row_errors'].append((row_idx, num, f'{type(exc).__name__}: {exc}'))

            # --- контрольный пересчёт итоговой суммы по всем затронутым договорам ---
            if touched_contract_ids:
                for contract in Contract.objects.filter(pk__in=touched_contract_ids):
                    total = sum((ci.contract_cost for ci in contract.items.all()), Decimal('0'))
                    Contract.objects.filter(pk=contract.pk).update(total_cost=total)

            if not apply_changes:
                transaction.set_rollback(True)

        self._print_report(stats, apply_changes)

    def _print_report(self, stats, apply_changes):
        mode = 'ПРИМЕНЕНО' if apply_changes else 'DRY-RUN (изменения НЕ сохранены)'
        self.stdout.write(self.style.WARNING(f'\n=== Режим: {mode} ==='))
        self.stdout.write(f"Обработано строк с num: {stats['rows_total']}")
        self.stdout.write(f"Непубликуемых PlanItem создано (is_public=False): {len(stats['non_public_created'])}")
        self.stdout.write(f"  из них без строки Purchases на нужный год (пропущены): {len(stats['non_public_no_purchases'])}")
        self.stdout.write(f"TreasuryPayment создано всего: {stats['payments_created']}")
        for kind_name, cnt in sorted(stats['payments_created_by_kind'].items()):
            self.stdout.write(f"  - {kind_name}: {cnt}")
        self.stdout.write(self.style.WARNING(
            f"\nПереходящие позиции — сопоставлено с планом прошлых лет: {len(stats['carryover_matched'])}"))
        self.stdout.write(
            f"  из них создана непубликуемая позиция прошлого года (нет среди опубликованных): "
            f"{len(stats['carryover_fallback_created'])}")
        self.stdout.write(self.style.WARNING(
            f"Переходящие позиции — НЕ сопоставлено уверенно (пропущено): {len(stats['carryover_unmatched'])}"))
        self.stdout.write(f"  из них BudgetCosts на 2026 год создано заново: {stats['carryover_budgetcost_created']}")
        if stats['carryover_year_unparsed']:
            self.stdout.write(self.style.ERROR(
                f"Переходящие позиции — не удалось разобрать год источника: {len(stats['carryover_year_unparsed'])}"))
        self.stdout.write(f"\nPlanItem не найден, причина не распознана: {len(stats['plan_item_not_found'])}")
        self.stdout.write(f"PlanItemDetail не найден: {len(stats['detail_not_found'])}")
        self.stdout.write(f"BudgetCosts не найден (нет строки на этот год): {len(stats['budget_cost_not_found'])}")
        self.stdout.write(f"Внутренний код ЭКР проставлен: {stats['internal_code_set']}")
        self.stdout.write(f"Внутренний код ЭКР НЕ найден в справочнике: {len(stats['internal_code_not_found'])}")
        self.stdout.write(f"PlanShare создано: {stats['plan_share_created']}, обновлено: {stats['plan_share_updated']}")
        self.stdout.write(f"Договоров создано: {stats['contract_created']}, строк договора создано: {stats['contract_item_created']}")
        self.stdout.write(f"Строк квартального финансирования записано: {stats['quarter_rows_written']}")
        self.stdout.write(f"Новых поставщиков (без УНП): {stats['supplier_created']}")
        self.stdout.write(self.style.WARNING(
            f"\nДержатель лимита не сопоставлен со справочником (PlanShare не создан): {len(stats['dept_unresolved'])}"))
        self.stdout.write(f"Бенефициар (W) не сопоставлен (не блокирует, просто не добавлен): {len(stats['beneficiary_unresolved'])}")
        self.stdout.write(f"Плановая дата поставки договора отсутствовала, взята дата заключения: {len(stats['delivery_date_fallback'])}")
        self.stdout.write(self.style.ERROR(f"Строк с ошибкой валидации (пропущены, savepoint откачен): {len(stats['row_errors'])}"))

        def dump(title, items, limit=25):
            if not items:
                return
            self.stdout.write(self.style.WARNING(f'\n--- {title} (первые {min(limit, len(items))} из {len(items)}) ---'))
            for item in items[:limit]:
                self.stdout.write('  ' + ' | '.join(str(x) for x in item))

        dump('Непубликуемые PlanItem созданы', stats['non_public_created'], limit=100)
        dump('Непубликуемые без Purchases на год', stats['non_public_no_purchases'])
        dump('Переходящие — сопоставлено', stats['carryover_matched'], limit=100)
        dump('Переходящие — создана непубликуемая позиция прошлого года', stats['carryover_fallback_created'], limit=100)
        dump('Переходящие — НЕ сопоставлено', stats['carryover_unmatched'], limit=100)
        dump('Переходящие — год источника не распознан', stats['carryover_year_unparsed'])
        dump('PlanItem не найден (причина не распознана)', stats['plan_item_not_found'])
        dump('Внутренний код ЭКР не найден', stats['internal_code_not_found'], limit=500)
        dump('Держатель лимита не сопоставлен', stats['dept_unresolved'])
        dump('Бенефициар не сопоставлен', stats['beneficiary_unresolved'], limit=500)
        dump('Ошибки валидации по строкам', stats['row_errors'], limit=500)

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                '\nЭто был предварительный прогон. Для реального сохранения запустите с флагом --apply.'))
