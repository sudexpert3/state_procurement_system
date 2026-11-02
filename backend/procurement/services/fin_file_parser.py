# -*- coding: utf-8 -*-
"""
Разбор файла fin_2026.xlsb от Казначейства (Этап 3.4).

Решение пользователя 2026-11-02 (пересмотрено после находки скрытого листа "T"):
источник данных — лист **"T"** (не "ЦА" — та оказалась просто сводной pivot-таблицей
НАД тем же листом "T", см. CurrentStatus.md). Лист "T" — плоская таблица-источник по ВСЕМ
организациям сразу (у каждой свой код "УНК"), с чистыми заголовками колонок (в отличие от
"ЦА", где часть заголовков — нерезолвленный rich-text "0x17"). Нас интересует только
организация с УНК 1534 (Центральный аппарат ГКСЭ, `settings.DEFAULT_UNK`) — остальные
строки принадлежат другим организациям того же министерства и фильтруются по этому коду,
а не по эвристике "раздел.подраздел функционального кода", как в первой версии парсера.

Колонки листа "T" (подтверждено по реальным заголовкам книги и арифметикой — числа
совпадают с тем, что ранее сверялось на листе "ЦА" для тех же (параграф, статья)):
  0  — УНК (код организации)
  1-9 — разложенные на цифры код раздела/подраздела/вида/параграфа и статьи (не нужны —
        собранные строкой коды уже есть в колонках 10/11)
  10 — "Код" — функциональный код вида "03_12_00_039_99_00" (подчёркивания)
  11 — "Ст" — код статьи ЭКР вида "1.10.03.99" (точки)
  12-15 — "План 1 кв".."План 4 кв" — квартальный лимit (то, что нам нужно для
          ArticleQuarterlyAllocation.amount)
  16+ — "Фин+"/помесячные "Фин NN"/"Своб. ассигн."/"Зарезерв. ср." — факт/остаток,
        не нужны для этой заявки (это не отчёт об исполнении, а именно корректировка лимита)

Конвертация кодов в формат наших справочников:
  - Параграф: "03_12_00_039_99_00" -> FunctionalCode.code_api "03 12 00 039"
    (первые 4 группы через пробел).
  - Статья: "1.10.03.99" -> ExternalEconomicCode.code_api "1 10 03 99" (точки -> пробелы).
    Не все статьи совпадают буквально после такой конвертации (напр. файл даёt
    "1.10.04.99", а в части наших данных используется "1 10 04 00") — несопоставленные
    статьи НЕ угадываются, попадают в report для специалиста.

Правила исключения — не забирать (решение пользователя):
  §039: статьи 1.10.01.00, 1.10.02.99, 1.30.03.99
  §042: статья 2.40.01.00 (решение из прошлого обсуждения, не отменено)
  §751: статьи 1.10.04.99, 1.10.05.00
"""
from decimal import Decimal, InvalidOperation

from django.conf import settings

from procurement.models import FunctionalCode, ExternalEconomicCode

SHEET_NAME = 'T'

COL_UNK = 0
COL_CODE = 10       # "Код" — функциональный код параграфа
COL_ARTICLE_CODE = 11  # "Ст" — код статьи ЭКР
QUARTER_COLS = [('Q1', 12), ('Q2', 13), ('Q3', 14), ('Q4', 15)]

EXCLUDED_ARTICLES = {
    ('03_12_00_039_99_00', '1.10.01.00'),
    ('03_12_00_039_99_00', '1.10.02.99'),
    ('03_12_00_039_99_00', '1.30.03.99'),
    ('03_12_00_042_99_00', '2.40.01.00'),
    ('03_12_00_751_99_00', '1.10.04.99'),
    ('03_12_00_751_99_00', '1.10.05.00'),
}


def _to_decimal(value):
    if value is None or value == '':
        return Decimal('0.00')
    try:
        return Decimal(str(value)).quantize(Decimal('0.01'))
    except InvalidOperation:
        return Decimal('0.00')


def _func_code_to_db_format(raw_code):
    """"03_12_00_039_99_00" -> "03 12 00 039" (первые 4 группы)."""
    return ' '.join(raw_code.split('_')[:4])


def _article_code_to_db_format(raw_code):
    """"1.10.03.99" -> "1 10 03 99"."""
    return raw_code.replace('.', ' ')


def parse_fin_file(file_path, year, unk=None, sheet_name=SHEET_NAME):
    """
    Возвращает (lines, report):
      lines — список {'functional_class': id, 'economic_class': id, 'year': year,
                       'quarter': 'Q1', 'amount': Decimal} для передачи в
                       services.change_requests.create_budget_limit_correction();
      report — диагностика для специалиста (несопоставленные коды — ожидаемая ситуация,
               требующая решения человека, не программы).
    """
    from pyxlsb import open_workbook  # импорт внутри функции — зависимость нужна только здесь

    target_unk = float(unk if unk is not None else settings.DEFAULT_UNK)

    func_cache = {fc.code_api: fc for fc in FunctionalCode.objects.all()}
    econ_cache = {ec.code_api: ec for ec in ExternalEconomicCode.objects.all()}

    lines = []
    report = {
        'rows_total': 0,
        'excluded': [],
        'functional_not_found': set(),
        'economic_not_found': set(),
        'matched_articles': 0,
    }

    with open_workbook(file_path) as wb:
        with wb.get_sheet(sheet_name) as sheet:
            for i, row in enumerate(sheet.rows(), start=1):
                if i == 1:
                    continue  # строка заголовков

                values = [c.v for c in row]
                if len(values) <= QUARTER_COLS[-1][1]:
                    continue

                if values[COL_UNK] != target_unk:
                    continue

                code = values[COL_CODE]
                article_code = values[COL_ARTICLE_CODE]
                if not code or not article_code:
                    continue

                report['rows_total'] += 1

                if (code, article_code) in EXCLUDED_ARTICLES:
                    report['excluded'].append((code, article_code))
                    continue

                func_obj = func_cache.get(_func_code_to_db_format(code))
                if not func_obj:
                    report['functional_not_found'].add(code)
                    continue

                econ_obj = econ_cache.get(_article_code_to_db_format(article_code))
                if not econ_obj:
                    report['economic_not_found'].add(article_code)
                    continue

                report['matched_articles'] += 1
                for quarter, col in QUARTER_COLS:
                    lines.append({
                        'functional_class': func_obj.pk, 'economic_class': econ_obj.pk,
                        'year': year, 'quarter': quarter, 'amount': _to_decimal(values[col]),
                    })

    return lines, report
