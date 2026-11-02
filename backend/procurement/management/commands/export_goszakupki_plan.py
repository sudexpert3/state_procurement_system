# -*- coding: utf-8 -*-
"""
Выгружает список позиций годового плана с goszakupki.by в JSON-файл.

Назначение: с машины разработки (в т.ч. в облаке) реальный API api.goszakupki.by
недоступен (нет VPN/сетевого доступа). Эта команда запускается на машине, у которой
доступ ЕСТЬ (например, у пользователя), и сохраняет результат в файл — тем же
списком объектов, что и procurement/data/api_data.json (используется во view
get_purchases_items и годится для отладки/повторного использования без сети).

Формат одного элемента результата — "как есть" от /purchase/view-item/{id}:
{
  "id": ..., "purchases_id": ..., "unp_budget": ..., "num": ..., "title": ...,
  "okrb": ..., "okrb_title": ..., "type": ..., "val_amount": ..., "val_type": ...,
  "fund_cost": ..., "inner_cost": ..., "val_currency": ..., "procedure_months": [...],
  "is_by_organizator": ..., "budget_costs": [ {...}, ... ]
}

Запуск (из backend/, с активным venv):
    python manage.py export_goszakupki_plan 68009                     # план 2026 года
    python manage.py export_goszakupki_plan 59258                     # план 2025 года
    python manage.py export_goszakupki_plan 68009 --out my_file.json
    python manage.py export_goszakupki_plan 68009 --limit 20          # быстрая проверка на первых 20

Известные purchase_id (см. procurement_purchases в БД): 2025 год -> 59258, 2026 год -> 68009.

Секреты (GPZ_USERNAME/GPZ_PASSWORD) берутся из .env как обычно — в вывод не попадают.
"""
import json
import time

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from api.api import GoszakupkiAPI


class Command(BaseCommand):
    help = 'Выгружает позиции годового плана закупок с goszakupki.by в JSON-файл (для работы без доступа к API).'

    def add_arguments(self, parser):
        parser.add_argument('purchase_id', type=int,
                            help='ID годового плана на портале (напр. 68009 — 2026 год, 59258 — 2025 год)')
        parser.add_argument('--out', type=str, default=None,
                            help='Путь к выходному .json (по умолчанию input/api_plan_<purchase_id>.json)')
        parser.add_argument('--limit', type=int, default=None,
                            help='Ограничить количество позиций (для быстрой проверки без полной выгрузки)')
        parser.add_argument('--delay', type=float, default=0.2,
                            help='Пауза между запросами деталей позиции, сек (по умолчанию 0.2 — не долбить портал)')

    def handle(self, *args, **options):
        purchase_id = options['purchase_id']
        limit = options['limit']
        delay = options['delay']
        out_path = options['out'] or str(settings.BASE_DIR.parent / 'input' / f'api_plan_{purchase_id}.json')

        client = GoszakupkiAPI()

        # --- шаг 1: постраничный список позиций плана (краткие данные + id) ---
        self.stdout.write(f'Получаю список позиций плана {purchase_id} ...')
        item_refs = []
        page = 1
        while True:
            try:
                data, headers = client.get_data(f'/purchase/items/{purchase_id}', params={'page': page})
            except Exception as exc:
                raise CommandError(f'Не удалось получить страницу {page} списка позиций: {exc}')

            if not data:
                break
            item_refs.extend(data)

            try:
                page_count = int(headers.get('X-Pagination-Page-Count', page))
            except (TypeError, ValueError):
                page_count = page

            self.stdout.write(f'  страница {page}/{page_count}, позиций собрано: {len(item_refs)}')

            if limit and len(item_refs) >= limit:
                item_refs = item_refs[:limit]
                break
            if page >= page_count:
                break
            page += 1

        if not item_refs:
            self.stdout.write(self.style.WARNING('Портал не вернул ни одной позиции — файл не создаю.'))
            return

        # --- шаг 2: детали каждой позиции (включая budget_costs) ---
        total = len(item_refs)
        self.stdout.write(f'Получаю детали {total} позиций (по одной, задержка {delay} сек между запросами)...')
        result = []
        errors = []

        for i, ref in enumerate(item_refs, start=1):
            item_id = ref.get('id')
            if not item_id:
                continue
            try:
                detail, _ = client.get_data(f'/purchase/view-item/{item_id}')
                result.append(detail)
            except Exception as exc:
                errors.append((item_id, str(exc)))
                self.stderr.write(self.style.ERROR(f'  [{i}/{total}] id={item_id}: {exc}'))

            if i % 25 == 0 or i == total:
                self.stdout.write(f'  [{i}/{total}] получено {len(result)}, ошибок {len(errors)}')
                self._save(out_path, result)  # промежуточное сохранение — не терять прогресс при обрыве связи

            if delay:
                time.sleep(delay)

        self._save(out_path, result)

        self.stdout.write(self.style.SUCCESS(
            f'Готово: {len(result)} из {total} позиций сохранено в {out_path}'
            + (f' ({len(errors)} с ошибками, см. вывод выше)' if errors else '')
        ))

    @staticmethod
    def _save(path, data):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
