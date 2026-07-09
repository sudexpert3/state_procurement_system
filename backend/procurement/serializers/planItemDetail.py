from rest_framework import serializers
from django.db import transaction
from core.choices import PlanItemStatus
from procurement.models import PlanItemDetail, OkrbProduct, UnitOfMeasurement
from .buyer import BuyerSerializer


class PlanItemDetailSerializer(serializers.ModelSerializer):
    buyer_detail = BuyerSerializer(source='buyer', read_only=True)
    class Meta:
        model = PlanItemDetail
        fields = ['id', 'plan_item', 'created_at', 'changed_at', 'status', 'purchases_item_id', 'purchases_id',
                  'unp_budget', 'num', 'title', 'okrb', 'okrb_title', 'okrb_product', 'type', 'val_amount',
                  'val_type', 'val_unit', 'fund_cost', 'inner_cost', 'val_currency', 'procedure_months',
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
        status = validated_data.pop('status', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if status is None or status == PlanItemStatus.ACTIVE:
            instance.status = PlanItemStatus.DRAFT
        else:
            instance.status = status

        instance.save()

        return instance


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

    def create(self, validated_data):
        """Идемпотентная запись: проверка дубликатов и сохранение записи подробной информации plan_item_detail"""

        plan_item = validated_data.get('plan_item')
        purchases_item_id = validated_data.get('purchases_item_id')
        print(f'PlanItemDetailImportSerializer. plan_item=', plan_item)
        print(f'PlanItemDetailImportSerializer. purchases_item_id=', purchases_item_id)
        api_months = validated_data.get('procedure_months', [])

        existing_pid_qs = PlanItemDetail.objects.filter(
            plan_item=plan_item,
            purchases_item_id=purchases_item_id,
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
            is_by_organizator=validated_data.get('is_by_organizator')
        )
        print(f'PlanItemDetailImportSerializer. validated_data=', validated_data)
        print(f'PlanItemDetailImportSerializer. existing_pid_qs=', existing_pid_qs)

        # Здесь нужно формировать массив данных, а не брать первую запись!!!!
        # Код ниже требует переработки
        target_record = None
        for record in existing_pid_qs:
            # Сравниваем списки месяцев без привязки к порядку элементов
            print(f'PlanItemDetailImportSerializer. {sorted(record.procedure_months)} == {sorted(api_months)}', sorted(record.procedure_months) == sorted(api_months))
            if sorted(record.procedure_months) == sorted(api_months):
                target_record = record
                break
        # Здесь нужно формировать массив данных, а не брать первую запись!!!!


        # Если у нас массив данных, то нужно анализировать какие записи в него вошли, какие статусы у этих записей
        # и в зависимости от состава, что дальше с ними делать!!!!
        # Код ниже требует переработки

        print(f'PlanItemDetailImportSerializer. target_record=', target_record)
        # Сценарий А: Полный дубликат уже активен в системе
        if target_record and target_record.status == PlanItemStatus.ACTIVE:
            return target_record

        # Сценарий Б: Идентичный черновик/пакет ротируется в ACTIVE
        elif target_record and target_record.status == PlanItemStatus.UPLOAD:
            with transaction.atomic():
                PlanItemDetail.objects.filter(
                    plan_item=plan_item,
                    status=PlanItemStatus.ACTIVE
                ).update(status=PlanItemStatus.ARCHIVE)

                # Активируем найденный пакет и сохраняем изменения в СУБД
                target_record.status = PlanItemStatus.ACTIVE
                target_record.save(update_fields=['status', 'changed_at'])

            return target_record

        # Сценарий В: Если запись найдена в промежуточных черновиках — уводим в архив
        elif target_record:
            if target_record.status in [PlanItemStatus.DRAFT, PlanItemStatus.DRAFT_ON_REVIEW,
                                        PlanItemStatus.DRAFT_APPROVED, PlanItemStatus.DRAFT_REJECTED]:
                target_record.delete()
                target_record = None


        # Если у нас массив данных, то нужно анализировать какие записи в него вошли, какие статусы у этих записей
        # и в зависимости от состава, что дальше с ними делать!!!!

        if 'status' not in validated_data:
            validated_data['status'] = PlanItemStatus.ACTIVE

        return super().create(validated_data)
