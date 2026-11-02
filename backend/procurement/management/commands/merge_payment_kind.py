# -*- coding: utf-8 -*-
"""
Разовая правка: лишний вид платежа "Оплата по договору из файла" (заведён по ошибке
2026-10-30 при расширении TreasuryPayment на все категории строк реестра, см.
CurrentStatus.md, Проход 12) объединяется с уже существующим "Платеж-перенос из файла" —
по решению пользователя не плодить лишние виды платежей, всё из одного переноса данных
логично помечать одним видом.

Переносит все TreasuryPayment с лишнего вида на целевой и удаляет лишнюю запись
KindOfPayment (FK on_delete=PROTECT — удаление возможно только когда ссылок не осталось).

Запуск (из backend/):
    python manage.py merge_payment_kind             # только отчёт
    python manage.py merge_payment_kind --apply      # реально сохраняет изменения
"""
from django.core.management.base import BaseCommand
from django.db import transaction

from procurement.models import KindOfPayment, TreasuryPayment

SOURCE_KIND_NAME = 'Оплата по договору из файла'
TARGET_KIND_NAME = 'Платеж-перенос из файла'


class Command(BaseCommand):
    help = f'Переносит TreasuryPayment с вида "{SOURCE_KIND_NAME}" на "{TARGET_KIND_NAME}" и удаляет лишний вид.'

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true',
                            help='Реально сохранить изменения. Без флага — только отчёт (dry-run).')

    def handle(self, *args, **options):
        apply_changes = options['apply']
        mode = 'ПРИМЕНЕНО' if apply_changes else 'DRY-RUN (изменения НЕ сохранены)'
        self.stdout.write(f'=== Режим: {mode} ===')

        source = KindOfPayment.objects.filter(name=SOURCE_KIND_NAME).first()
        if not source:
            self.stdout.write(f'Вид "{SOURCE_KIND_NAME}" не найден — уже объединено или не создавалось.')
            return
        target = KindOfPayment.objects.filter(name=TARGET_KIND_NAME).first()
        if not target:
            self.stderr.write(self.style.ERROR(f'Целевой вид "{TARGET_KIND_NAME}" не найден — что-то не так.'))
            return

        affected = TreasuryPayment.objects.filter(kind=source)
        count = affected.count()
        self.stdout.write(f'Платёжек на переносе с "{SOURCE_KIND_NAME}" (id={source.pk}) '
                          f'на "{TARGET_KIND_NAME}" (id={target.pk}): {count}')

        with transaction.atomic():
            if apply_changes:
                affected.update(kind=target)
                source.refresh_from_db()
                remaining = source.treasury_payments.count()
                if remaining:
                    self.stderr.write(self.style.ERROR(
                        f'После переноса у "{SOURCE_KIND_NAME}" осталось {remaining} ссылок — не удаляю.'))
                else:
                    source.delete()
                    self.stdout.write(self.style.SUCCESS(f'Вид "{SOURCE_KIND_NAME}" удалён.'))
            if not apply_changes:
                transaction.set_rollback(True)

        if not apply_changes:
            self.stdout.write(self.style.WARNING(
                'Это был предварительный прогон. Для реального сохранения запустите с флагом --apply.'))
