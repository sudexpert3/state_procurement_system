from rest_framework import serializers
from datetime import datetime
from django.utils import timezone
from procurement.models import Purchases


class PurchasesSerializer(serializers.ModelSerializer):
    class Meta:
        model = Purchases
        fields = [
            'id', 'purchase_id', 'purchase_num', 'company', 'ved', 'country', 'region', 'city', 'address',
            'establishment', 'date_added', 'date_edit', 'date_sign', 'signer_descrip', 'sender_descrip', 'year',
            'is_draft', 'at_updated'
        ]


class PurchasesImportSerializer(serializers.ModelSerializer):
    """
    СЕРИАЛИЗАТОР ИМПОРТА: Парсит входящий ответ API goszakupki.by.
    Маппит внешние ключи (id -> purchase_id, num -> purchase_num) и
    автоматически обрабатывает системные метки времени Минфина РБ.
    """
    # Принимаем оригинальные ключи ответа goszakupki.by во входной JSON-пакет
    id = serializers.IntegerField(write_only=True)
    num = serializers.CharField(write_only=True, required=False, allow_null=True)

    class Meta:
        model = Purchases
        fields = [
            'id', 'num', 'purchase_id', 'purchase_num', 'company', 'ved',
            'country', 'region', 'city', 'address', 'establishment',
            'date_added', 'date_edit', 'date_sign', 'year', 'is_draft', 'at_updated'
        ]

        extra_kwargs = {
            'purchase_id': {'required': False},
            'purchase_num': {'required': False, 'allow_null': True, 'allow_blank': True},
        }

    def to_internal_value(self, data):
        """
        Казначейский конвертер данных ГКСЭ.
        Превращает Unix Timestamp (int) в ISO DateTime и маппит ключи API.
        """
        raw_data = data.copy()

        if 'id' in raw_data and raw_data['id']:
            raw_data['purchase_id'] = raw_data['id']
        if 'num' in raw_data and raw_data['num']:
            raw_data['purchase_num'] = str(raw_data['num']).strip()

        datetime_fields = ['date_added', 'date_edit', 'date_sign']
        for field in datetime_fields:
            timestamp_val = raw_data.get(field)

            # Если пришло число (int/float), превращаем его в часовой пояс системы
            if timestamp_val and isinstance(timestamp_val, (int, float)):
                try:
                    # Превращаем секунды в осознанную Python-дату
                    dt_object = datetime.fromtimestamp(timestamp_val, tz=timezone.get_current_timezone())
                    # Превращаем в строку ISO 8601, которую намертво затребует DRF (например, "2019-08-07T14:39:05")
                    raw_data[field] = dt_object.isoformat()
                except Exception:
                    raw_data[field] = None
            elif timestamp_val == "":
                raw_data[field] = None

        # 3. Обработка строкового поля 'at_updated' (замена пробела на 'T' для DRF)
        if 'at_updated' in raw_data and isinstance(raw_data['at_updated'], str):
            val = raw_data['at_updated'].strip()
            if " " in val and "T" not in val:
                raw_data['at_updated'] = val.replace(" ", "T")

        # 4. Защитный strip() для текстовой географии
        for field in ['region', 'city', 'address', 'sender_descrip', 'signer_descrip', 'company', 'ved']:
            if raw_data.get(field) and isinstance(raw_data[field], str):
                raw_data[field] = raw_data[field].strip()

        return super().to_internal_value(raw_data)

    def create(self, validated_data):
        """
        Идемпотентный метод сохранения (Защита СУБД от дубликатов).
        Если план с таким purchase_id уже скачивался ранее, мы обновляем его
        актуальные метки времени, а не плодим новые строки.
        """
        purchase_id = validated_data.get('purchase_id')

        validated_data.pop('id', None)
        validated_data.pop('num', None)

        # Метод update_or_create выполнит легкий индексный поиск по purchase_id
        instance, created = Purchases.objects.update_or_create(
            purchase_id=purchase_id,
            defaults=validated_data
        )
        return instance




# class PurchasesExportSerializer(serializers.ModelSerializer):
#     """
#     СЕРИАЛИЗАТОР ЭКСПОРТА: Формирует строго структурированный JSON-пакет
#     для выгрузки черновика годового плана на goszakupki.by для последующего подписания ЭЦП.
#     """
#     # Возвращаем порталу ожидаемые им имена полей (id и num) вместо внутренних названий СУБД
#     id = serializers.IntegerField(source='purchase_id', read_only=True)
#     num = serializers.CharField(source='purchase_num', read_only=True)
#
#     class Meta:
#         model = Purchases
#         fields = [
#             'id', 'num', 'company', 'ved', 'country', "region", "city", "address", 'establishment', "signer_descrip",
#             "sender_descrip" 'year', 'is_draft',
#         ]
