from rest_framework import serializers
from django.db import transaction
from core.choices import PlanItemStatus
from procurement.models import PlanItemDetail, OkrbProduct, UnitOfMeasurement
from .buyer import BuyerSerializer


class PlanItemDetailSerializer(serializers.ModelSerializer):
    buyer_detail = BuyerSerializer(source='buyer', read_only=True)
    class Meta:
        model = PlanItemDetail
        fields = ['id', 'plan_item', 'created_at', 'changed_at', 'status', 'change_request', 'purchases_item_id',
                  'purchases_id', 'unp_budget', 'num', 'title', 'okrb', 'okrb_title', 'okrb_product', 'type',
                  'val_amount', 'val_type', 'val_unit', 'fund_cost', 'inner_cost', 'val_currency', 'procedure_months',
                  'is_by_organizator', 'buyer', 'buyer_detail'
                  ]
        extra_kwargs = {
            'created_at': {'required': False},
            'changed_at': {'required': False},
            'status': {'required': False},
            'okrb_product': {'required': False, 'allow_null': True},
            'val_unit': {'required': False, 'allow_null': True},
            'purchases_item_id': {'required': False},
        }

    def update(self, instance, validated_data):
        # КРИТИЧНЫЙ БАГ (найден агентом-фронтендом, 2026-11-16): раньше ЛЮБОЙ PATCH —
        # даже не затрагивающий status вовсе (напр. {"buyer": 4}) — принудительно сбрасывал
        # status в DRAFT, потому что `status is None` (поле не передано) тоже попадало в
        # условие "ставим DRAFT". Это ломало прямое редактирование полей ACTIVE-записи
        # (buyer/internal_economic_class — разрешено роли FINANCIER без ChangeRequest, см.
        # core/choices.py), а заодно не давало вручную исправить уже сломанную запись через
        # PATCH {"status": "ACTIVE"} — та же ветка перехватывала и его. Воспроизведено на
        # PlanItemDetail.id=2898, см. CurrentStatus.md.
        #
        # Сохранён единственный осмысленный защитный смысл исходного кода: активация
        # записи напрямую через голый PATCH действительно опасна — она не архивирует старую
        # ACTIVE-версию (в отличие от services/change_requests.py::approve()) и может
        # оставить у позиции плана ДВЕ одновременно ACTIVE записи (DB-уровневого ограничения
        # на это нет — история таких задвоений подробно описана в CurrentStatus.md). Поэтому
        # явный переход В ACTIVE из ЛЮБОГО другого статуса по-прежнему запрещён — но теперь
        # явной ошибкой 400, а не тихой подменой на DRAFT; все остальные случаи (status не
        # передан, либо передан, но совпадает с текущим, либо меняется на любой НЕ-ACTIVE
        # статус) обрабатываются как обычное частичное обновление.
        requested_status = validated_data.get('status')
        if (
            requested_status == PlanItemStatus.ACTIVE
            and instance.status != PlanItemStatus.ACTIVE
        ):
            raise serializers.ValidationError({
                'status': 'Активировать позицию напрямую нельзя — используйте одобрение заявки на изменение '
                          '(ChangeRequest.approve), иначе у позиции может оказаться две ACTIVE-записи одновременно.'
            })

        return super().update(instance, validated_data)


class PlanItemDetailImportSerializer(serializers.ModelSerializer):
    """
    Специализированный сериализатор импорта и версионирования текстовых спецификаций ГПЗ.
    Автоматически очищает данные и связывает сырые коды с ведомственными справочниками.
    """

    class Meta:
        model = PlanItemDetail
        fields = [
            'plan_item', 'status', 'purchases_item_id', 'purchases_id',
            'unp_budget', 'num', 'title', 'okrb', 'okrb_title', 'okrb_product',
            'type', 'val_amount', 'val_type', 'val_unit', 'fund_cost', 'inner_cost',
            'val_currency', 'procedure_months', 'is_by_organizator'
        ]
        extra_kwargs = {
            'plan_item': {'required': False},  # Передается программно в цикле вьюхи
            'purchases_item_id': {'required': False},  # Передается программно в цикле вьюхи
            'okrb_product': {'required': False, 'allow_null': True},  # Разрешается в validate()
            'val_unit': {'required': False, 'allow_null': True},  # Разрешается в validate()
            'status': {'required': False},  # По умолчанию выставляется программно
        }

    def to_internal_value(self, data):
        """ Очистка сырых данных, полученных от goszakupki.by """
        if not isinstance(data, dict):
            return super().to_internal_value(data)

        raw_data = data.copy()
        original_id = raw_data.pop('id')

        for field in ['num', 'unp_budget', 'title', 'okrb', 'okrb_title', 'type', 'val_type', 'val_currency', ]:
            if field in raw_data and (raw_data[field] is None or str(raw_data[field]).strip() == ""):
                raw_data[field] = None
            else:
                raw_data[field] = str(raw_data[field]).strip()

        # Страхуем входящие числовые поля, если API прислало их в виде текста
        for decimal_field in ['val_amount', 'fund_cost', 'inner_cost']:
            if decimal_field not in raw_data or raw_data[decimal_field] is None or str(raw_data[decimal_field]).strip() == "":
                raw_data[decimal_field] = '0.00'
            elif isinstance(raw_data[decimal_field], str):
                # Если пришла строка, убираем пробелы и правим белорусскую запятую на точку
                raw_data[decimal_field] = raw_data[decimal_field].replace(',', '.').strip()
                if raw_data[decimal_field] == "":
                    raw_data[decimal_field] = '0.00'

        if 'is_by_organizator' in raw_data:
            is_by_org = raw_data['is_by_organizator']
            if isinstance(is_by_org, str):
                raw_data['is_by_organizator'] = is_by_org.lower().strip() == 'true'
            else:
                raw_data['is_by_organizator'] = bool(is_by_org)

        return super().to_internal_value(raw_data)

    def validate(self, attrs):
        """ Автоматическое связывание со справочниками.
           Превращает сырые коды Минфина в полноценные объекты СУБД PostgreSQL.
        """
        okrb_code = attrs.get('okrb', None)
        okrb_title = attrs.get('okrb_title', '')
        if okrb_code:
            okrb_obj, _ = OkrbProduct.objects.get_or_create(
                code=okrb_code,
                defaults={"title": f"НОВЫЙ: {okrb_title}", "is_active": True}
            )
            attrs["okrb_product"] = okrb_obj

        val_type_code = attrs.get('val_type', None)
        if val_type_code:
            val_unit_obj, _ = UnitOfMeasurement.objects.get_or_create(
                code=val_type_code,
                defaults={"short_name": f"НОВЫЙ: {val_type_code}", "is_active": True}
            )
            attrs["val_unit"] = val_unit_obj

        # Принудительно форматируем список месяцев, если он пришел в виде строки, а не JSON-массива
        procedure_months = attrs.get('procedure_months')
        if isinstance(procedure_months, str):
            import json
            try:
                attrs['procedure_months'] = json.loads(procedure_months)
            except (ValueError, TypeError):
                attrs['procedure_months'] = []

        return attrs

    # Поля, которые реально описывают "ту же спецификацию" с портала — расхождение в
    # любом из них означает новую версию, а не дубль синхронизации. procedure_months
    # сравнивается отдельно (см. ниже) — порядок элементов в списке не значим.
    _MUTABLE_FIELDS = (
        'purchases_item_id', 'purchases_id', 'unp_budget', 'num', 'title', 'okrb', 'okrb_title',
        'okrb_product', 'type', 'val_amount', 'val_type', 'val_unit', 'fund_cost', 'inner_cost',
        'val_currency', 'is_by_organizator',
    )

    def create(self, validated_data):
        """Версионирование по образцу BudgetCosts (см. serializers/budgetCosts.py, решение
        2026-10-28): сопоставление по стабильному ключу (plan_item), статус ACTIVE. Если
        значения совпали — повтор синхронизации, запись не трогаем. Если разошлись — старый
        снимок в ARCHIVE (неизменным — это и есть история), новый — ACTIVE. buyer и
        beneficiary_departments — локально проставленные поля (см. import_reestr26.py,
        портал о них не знает) — переносим на новый снимок, чтобы не терять их при каждой
        ресинхронизации.

        Было: при расхождении значений создавалась новая запись, но старая ACTIVE не
        архивировалась — на 2026-10-27 найдено 22 позиции плана с двумя ACTIVE
        PlanItemDetail одновременно (см. CurrentStatus.md).
        """
        plan_item = validated_data.get('plan_item')
        api_months = validated_data.get('procedure_months') or []

        target_record = PlanItemDetail.objects.filter(
            plan_item=plan_item, status=PlanItemStatus.ACTIVE,
        ).first()

        if target_record:
            changed = sorted(target_record.procedure_months or []) != sorted(api_months)
            if not changed:
                changed = any(
                    field in validated_data and getattr(target_record, field) != validated_data[field]
                    for field in self._MUTABLE_FIELDS
                )

            # Сценарий А: полный повтор синхронизации — ничего не изменилось.
            if not changed:
                return target_record

            # Сценарий А2: значения разошлись — версионируем.
            with transaction.atomic():
                target_record.status = PlanItemStatus.ARCHIVE
                target_record.save(update_fields=['status', 'changed_at'])

                new_data = dict(validated_data)
                new_data['status'] = PlanItemStatus.ACTIVE
                new_data.setdefault('buyer', target_record.buyer)
                new_record = super().create(new_data)
                new_record.beneficiary_departments.set(target_record.beneficiary_departments.all())

            return new_record

        # Сценарий Б/В — ротация UPLOAD-пакета или чистка промежуточных черновиков. Это
        # отдельный (пока не задействованный синхронизацией с порталом) workflow Этапа 2 —
        # ищем среди НЕактивных записей полное совпадение, как и раньше.
        existing_pid_qs = PlanItemDetail.objects.filter(
            plan_item=plan_item,
            purchases_item_id=validated_data.get('purchases_item_id'),
            purchases_id=validated_data.get('purchases_id'),
            unp_budget=validated_data.get('unp_budget'),
            num=validated_data.get('num'),
            title=validated_data.get('title'),
            okrb=validated_data.get('okrb'),
            val_amount=validated_data.get('val_amount'),
            val_type=validated_data.get('val_type'),
            fund_cost=validated_data.get('fund_cost'),
            inner_cost=validated_data.get('inner_cost'),
            val_currency=validated_data.get('val_currency'),
            is_by_organizator=validated_data.get('is_by_organizator'),
        ).exclude(status=PlanItemStatus.ACTIVE)

        target_record = None
        for record in existing_pid_qs:
            if sorted(record.procedure_months or []) == sorted(api_months):
                target_record = record
                break

        if target_record and target_record.status == PlanItemStatus.UPLOAD:
            with transaction.atomic():
                PlanItemDetail.objects.filter(
                    plan_item=plan_item,
                    status=PlanItemStatus.ACTIVE
                ).update(status=PlanItemStatus.ARCHIVE)

                target_record.status = PlanItemStatus.ACTIVE
                target_record.save(update_fields=['status', 'changed_at'])

            return target_record

        # Сценарий В: запись найдена в промежуточных черновиках — уводим в архив
        elif target_record:
            if target_record.status in [PlanItemStatus.DRAFT, PlanItemStatus.DRAFT_ON_REVIEW,
                                        PlanItemStatus.DRAFT_APPROVED, PlanItemStatus.DRAFT_REJECTED]:
                target_record.delete()

        if 'status' not in validated_data:
            validated_data['status'] = PlanItemStatus.ACTIVE

        return super().create(validated_data)
