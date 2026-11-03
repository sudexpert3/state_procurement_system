from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from api.api import GoszakupkiAPI
from procurement.models import Purchases
from procurement.serializers import PurchasesImportSerializer
from procurement.services.goszakupki_sync import fetch_purchase_items_from_api, sync_plan_items_from_data


@api_view(['GET'])
@permission_classes([AllowAny])
def get_data_gpz(request, purchase_id):
    page = request.query_params.get('page', 1)
    try:
        page = int(page)
    except (ValueError, TypeError):
        page = 1

    client = GoszakupkiAPI()
    data, headers = [], {}
    try:
        # data, headers = data = client.get_data(f"/purchase/all")
        # data, headers  = client.get_data(f"/purchase/create")
        # data, headers = data = client.get_data(f"/purchase/68009")
        # data, headers = client.get_data(f"/purchase/items/{purchase_id}?page={page}")
        # data, headers = client.get_data("/purchase/view-item/119050286")
        data, headers = client.get_data("/purchase/view-item/119050176")


        # data = client.get_data(f"/purchase/items/57859?page=2")
        # data = client.get_data(f"/purchase/items/10229") #2019
        # data = client.get_data(f"/purchase/items/25380") #2020
        # data = client.get_data(f"/purchase/items/34105") #2021
        # data = client.get_data(f"/purchase/items/40623") #2022
        # data = client.get_data(f"/purchase/items/42511") #2023
        # data = client.get_data(f"/purchase/items/57859?page={page_str}") #2024
        # data = client.get_data(f"/purchase/items/59258") #2025
        # data = client.get_data(f"/purchase/items/68009?page={page_str}") #2026
        # data = client.get_data(f"/purchase/items/68009?page={page_str}") #2026
        # data = client.get_data(f"/purchase/view-item/86808628") # 2024-102377498-578 услуги по разработке ДНК
        # data = client.get_data(f"/purchase/view-item/119050190") # 2026-102377498-15 услуги по питанию
        # data = client.get_data(f"/purchase/budget-cost/86808628") # 2024-102377498-578 услуги по разработке ДНК
        # data = client.get_data("/purchase/budget-cost/119050176")
        # data = client.get_data("/purchase/budget-cost")
        # data = client.get_data("/purchase/budget-cost/119050286")
        # data = client.get_data("/purchase/view-item/119050176")
        # data = client.get_data("/purchase/view-item/119050286")

    except Exception as e:
        return Response(
            {"error": f"Сетевой сбой шлюза при постраничном обходе ИС 'Тендеры': {str(e)}"},
            status=status.HTTP_502_BAD_GATEWAY
        )

    return Response(data=data, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([AllowAny])
def get_purchases_view(request):
    client = GoszakupkiAPI()

    result_data = []
    try:
        temp_data, _ = client.get_data(f"/purchase/all")
        if temp_data:
            for plan in temp_data:
                if plan.get('id'):
                    detail_info, _ = client.get_data(f"/purchase/{plan['id']}")
                    result_data.append(detail_info)

    except Exception as e:
        return Response(
            {
                "error": f"Сетевой сбой при связи с API goszakupki.by last_id: {result_data[-1]['id'] if result_data else 'empty result_data'}: {str(e)} "},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    if not result_data:
        return Response(
            {"status": "empty", "message": "Сайт goszakupki.by не вернул ни одного годового плана."},
            status=status.HTTP_200_OK
        )

    try:
        is_many = isinstance(result_data, list)
        serializer = PurchasesImportSerializer(data=result_data, many=is_many)
        serializer.is_valid(raise_exception=True)
    except Exception as e:
        return Response(
            {"error": f"Сбой при сериализации данных, полученных с goszakupki.by: {str(e)}"},
            status=status.HTTP_400_BAD_REQUEST
        )

    try:
        with transaction.atomic():
            saved_purchases = serializer.save()

        return Response(
            {
                "status": "success",
                "message": f"Годовые планы ({len(saved_purchases)} шт.) успешно импортированы в СУБД PostgreSQL"
            },
            status=status.HTTP_201_CREATED
        )
    except Exception as e:
        return Response(
            {"error": f"Ошибка СУБД при сохранении сериализованных данных в PostgreSQL: {str(e)}"},
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET'])
@permission_classes([AllowAny])
def get_purchases_items(request, purchase_id):
    """
    Каскадный импорт детальных спецификаций ГПЗ с автоматической фиксацией в БД.
    Логика синхронизации вынесена в procurement.services.goszakupki_sync — используется
    также management-командой sync_goszakupki_from_file для офлайн-файлов (когда прямого
    доступа к api.goszakupki.by нет).

    Данные читаются с реального API (fetch_purchase_items_from_api — та же пагинация, что
    в export_goszakupki_plan.py). Из этой среды разработки прямой доступ к api.goszakupki.by
    недоступен (см. CurrentStatus.md, Этап 5) — реальный прогон предстоит пользователю; для
    офлайн-работы без сети остаётся sync_goszakupki_from_file (та же sync_plan_items_from_data
    поверх заранее выгруженного файла).
    """
    purchase_master = get_object_or_404(Purchases, purchase_id=purchase_id)
    try:
        result_data = fetch_purchase_items_from_api(purchase_id)
    except Exception as e:
        return Response(
            {"error": f"Сбой при получении позиций плана {purchase_id} с goszakupki.by: {e}"},
            status=status.HTTP_502_BAD_GATEWAY
        )

    if not result_data:
        return Response(
            {"status": "empty", "message": "План на портале не содержит детальных пунктов закупки."},
            status=status.HTTP_200_OK
        )

    stats = sync_plan_items_from_data(purchase_master, result_data, log=print)

    return Response({
        "status": "success",
        "message": "Синхронизация с ИС 'Тендеры' успешно завершена.",
        "details": {
            "TOTAL_PLAN_ITEM_COUNT": stats['total'],
            "imported_plan_item_count": stats['imported'],
            "updated_plan_item_count": stats['updated'],
            "skiped_plan_item_count": stats['skipped'],
            "imported_budget_costs_item_count": stats['budget_imported'],
            "updated_budget_costs_item_count": stats['budget_updated'],
            "archived_plan_item_count": stats['archived'],
        }
    }, status=status.HTTP_200_OK)
