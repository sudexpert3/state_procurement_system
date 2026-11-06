"""Нормализация "группированных" кодов классификации, приходящих из API goszakupki.by.

Найдено 2026-11-06 (жалоба фронтенда на дублирующиеся коды в справочниках
`/api/functional_code/`/`/api/economic_code/`, пример пользователя: "1 10 01 05" и "1 10 1 5"
— один и тот же код статьи, две разные строки в БД). Разбор реальных данных подтвердил:
goszakupki.by в одних синхронизациях отдавал код с ведущими нулями в каждой группе (канонический
формат, совпадает с примерами из `doc/api.yaml`: functional_code "10 00 00 847",
economic_code "1 00 00 00", program_code "010 00"), а в других — тот же код без ведущих нулей
("3 12 0 39" вместо "03 12 00 039"). `BudgetCostsImportSerializer.to_internal_value()` до этой
правки распознавал только уже встреченные вручную варианты (жёсткий список точных строк) —
любой новый невиданный вариант проходил бы в `get_or_create()` как будто это новый код и плодил
бы очередной дубль в справочнике. Здесь — общее правило вместо списка частных случаев: ширины
групп фиксированы для каждого типа кода (видно по каноническим примерам из спецификации и по
уже накопленным в БД совпадающим парам), поэтому формат можно восстановить без справочной
таблицы соответствий.
"""

# Ширины групп канонической формы — подтверждены примерами из doc/api.yaml и проверкой
# совпадения уже существующих в БД пар "сжатый вариант" / "с ведущими нулями".
FUNCTIONAL_CODE_GROUP_WIDTHS = (2, 2, 2, 3)   # "03 12 00 039"
ECONOMIC_CODE_GROUP_WIDTHS = (1, 2, 2, 2)     # "1 10 10 99"
PROGRAM_CODE_GROUP_WIDTHS = (3, 2)            # "099 00"


def normalize_grouped_code(raw_code, group_widths):
    """Приводит код вида "1 10 1 5" к канонической форме "1 10 01 05" по заданным ширинам
    групп. Если формат неожиданный (другое число групп, нечисловая группа) — возвращает код
    как есть, не выдумывая структуру: пусть несовпадение проявится там, где его легко заметить
    (несопоставленный код в отчёте), а не будет молча искажено."""
    if not raw_code:
        return raw_code

    parts = raw_code.split()
    if len(parts) != len(group_widths):
        return raw_code

    try:
        return ' '.join(str(int(part)).zfill(width) for part, width in zip(parts, group_widths))
    except ValueError:
        return raw_code


def normalize_functional_code(raw_code):
    return normalize_grouped_code(raw_code, FUNCTIONAL_CODE_GROUP_WIDTHS)


def normalize_economic_code(raw_code):
    return normalize_grouped_code(raw_code, ECONOMIC_CODE_GROUP_WIDTHS)


def normalize_program_code(raw_code):
    return normalize_grouped_code(raw_code, PROGRAM_CODE_GROUP_WIDTHS)
