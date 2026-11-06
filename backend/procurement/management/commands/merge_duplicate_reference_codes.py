# -*- coding: utf-8 -*-
"""
Разовая правка: справочники `FunctionalCode`/`ExternalEconomicCode`/`ProgramCode` накопили
дубли одного и того же кода в двух форматах — goszakupki.by в разных синхронизациях отдавал
код то с ведущими нулями в каждой группе (канонический формат — совпадает с примерами из
`doc/api.yaml`), то без них ("сжатый" формат, например functional_code "3 12 0 039" вместо
"03 12 00 039", или экономический код "1 10 1 5" вместо "1 10 01 05" — см. CurrentStatus.md,
Этап 4.6). `BudgetCostsImportSerializer` теперь нормализует код ДО связывания со справочником
(procurement/services/code_normalization.py) — новые дубли больше не появятся, но уже
накопленные за прошлые синхронизации нужно почистить один раз.

Для каждого справочника и каждой строки:
  - вычисляем каноническую форму кода;
  - если каноническая форма уже существует как ДРУГАЯ строка — переносим все ссылки
    (BudgetCosts/TreasuryPayment/ArticleQuarterlyAllocation/DepartmentArticleLimit) на
    канонический объект и удаляем дубль (FK `on_delete=PROTECT` — удаление безопасно
    только когда ссылок не осталось, что мы и обеспечиваем переносом);
  - если канонической формы ещё не было — просто переименовываем строку на месте
    (это не дубль, просто код без ведущих нулей, под который пока нет второй записи).

Запуск (из backend/):
    python manage.py merge_duplicate_reference_codes             # только отчёт
    python manage.py merge_duplicate_reference_codes --apply      # реально сохраняет изменения
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from procurement.models import (
    FunctionalCode, ExternalEconomicCode, ProgramCode,
    BudgetCosts, TreasuryPayment, ArticleQuarterlyAllocation, DepartmentArticleLimit,
)
from procurement.services.code_normalization import (
    normalize_functional_code, normalize_economic_code, normalize_program_code,
)

# (справочник, функция нормализации, [(модель, имя FK-поля на справочник), ...])
REFERENCE_CONFIGS = [
    (FunctionalCode, normalize_functional_code, [
        (BudgetCosts, 'functional_class'),
        (TreasuryPayment, 'functional_class'),
        (ArticleQuarterlyAllocation, 'functional_class'),
        (DepartmentArticleLimit, 'functional_class'),
    ]),
    (ExternalEconomicCode, normalize_economic_code, [
        (BudgetCosts, 'economic_class'),
        (TreasuryPayment, 'economic_class'),
        (ArticleQuarterlyAllocation, 'economic_class'),
        (DepartmentArticleLimit, 'economic_class'),
    ]),
    (ProgramCode, normalize_program_code, [
        (BudgetCosts, 'program_class'),
        (TreasuryPayment, 'program_class'),
    ]),
]


class Command(BaseCommand):
    help = 'Сливает дублирующиеся коды ЭКР/функц./программной классификации (разные форматы ведущих нулей от goszakupki.by).'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true',
                            help='Реально сохранить изменения. Без флага — только отчёт (dry-run).')

    def handle(self, *args, **options):
        apply_changes = options['apply']
        mode = 'ПРИМЕНЕНО' if apply_changes else 'DRY-RUN (изменения НЕ сохранены)'
        self.stdout.write(f'=== Режим: {mode} ===')

        with transaction.atomic():
            for model, normalize_fn, referencing in REFERENCE_CONFIGS:
                self._process_model(model, normalize_fn, referencing, apply_changes)

            if not apply_changes:
                transaction.set_rollback(True)

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                'Это был предварительный прогон. Для реального сохранения запустите с флагом --apply.'))

    def _process_model(self, model, normalize_fn, referencing, apply_changes):
        self.stdout.write(f'\n--- {model.__name__} ---')
        renamed, merged = 0, 0

        # list() — чтобы безопасно переименовывать/удалять строки по ходу итерации,
        # не завязываясь на живой курсор БД.
        for obj in list(model.objects.order_by('id')):
            canonical_code = normalize_fn(obj.code_api)
            if canonical_code == obj.code_api:
                continue  # уже канонический формат — не трогаем

            canonical_obj = model.objects.filter(code_api=canonical_code).exclude(pk=obj.pk).first()

            if canonical_obj is None:
                self.stdout.write(f'  Переименование: "{obj.code_api}" -> "{canonical_code}" (id={obj.pk})')
                if apply_changes:
                    obj.code_api = canonical_code
                    obj.save(update_fields=['code_api'])
                renamed += 1
                continue

            self.stdout.write(
                f'  Слияние: "{obj.code_api}" (id={obj.pk}) -> "{canonical_code}" (id={canonical_obj.pk})'
            )
            total_repointed = 0
            for ref_model, fk_field in referencing:
                qs = ref_model.objects.filter(**{fk_field: obj})
                count = qs.count()
                if count:
                    total_repointed += count
                    self.stdout.write(f'    {ref_model.__name__}.{fk_field}: {count} запись(ей)')
                    if apply_changes:
                        qs.update(**{fk_field: canonical_obj})

            if apply_changes:
                obj.refresh_from_db()
                remaining = sum(
                    ref_model.objects.filter(**{fk_field: obj}).count() for ref_model, fk_field in referencing
                )
                if remaining:
                    self.stderr.write(self.style.ERROR(
                        f'    После переноса у id={obj.pk} осталось {remaining} ссылок — не удаляю.'))
                else:
                    obj.delete()
            merged += 1

        self.stdout.write(f'  Итого: переименовано {renamed}, слито {merged}.')
