from django.db import transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from api.api import GoszakupkiAPI
from core.choices import PlanItemStatus
from procurement.models import (Purchases, PlanItem, PlanItemDetail, BudgetCosts)
from procurement.serializers import (PurchasesImportSerializer, PlanItemDetailImportSerializer, BudgetCostsImportSerializer)
from procurement.services.get_data_from_file import get_API_data


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
    Каскадный постраничный импорт детальных спецификаций ГПЗ
    с автоматической фиксацией в СУБД PostgreSQL.
    """

    purchase_master = get_object_or_404(Purchases, purchase_id=purchase_id)
    page = 1
    client = GoszakupkiAPI()
    # result_data = []

    result_data = get_API_data('api_data.json')

    if purchase_master and purchase_master.id:
        # try:
        #     data, headers = client.get_data(f"/purchase/items/{purchase_id}?page={page}")
        #     count = int(headers['X-Pagination-Page-Count']) if headers.get('X-Pagination-Page-Count') else 1
        #
        #     while page < count + 1 and data:
        #         for item in data:
        #             if item.get('id'):
        #                 try:
        #                     item_data, _ = client.get_data(f"/purchase/view-item/{item['id']}")
        #                     if item_data:
        #                         result_data.append(item_data)
        #                 except Exception as e:
        #                     return Response(
        #                         {
        #                             "error": f"Сбой при получении с goszakupki.by пункта плана с id {item['id']}. номер: {item['num']}. ERROR: {str(e)}"},
        #                         status=status.HTTP_400_BAD_REQUEST
        #                     )
        #
        #         print(f"GET page={page} of {count} is OK! Собрано пунктов: {len(result_data)}")
        #         page += 1
        #         if page < count + 1:
        #             data, _ = client.get_data(f"/purchase/items/{purchase_id}?page={page}")
        #
        # except Exception as e:
        #     return Response(
        #         {"error": f"Сетевой сбой шлюза при постраничном обходе ИС 'Тендеры': {str(e)}"},
        #         status=status.HTTP_502_BAD_GATEWAY
        #     )

        if not result_data:
            return Response(
                {"status": "empty", "message": "План на портале не содержит детальных пунктов закупки."},
                status=status.HTTP_200_OK
            )

        # return Response(data=result_data, status=status.HTTP_200_OK)

        total_plan_item_count = len(result_data)
        imported_plan_item_count = 0
        updated_plan_item_count = 0
        skiped_plan_item_count = 0
        imported_budget_costs_item_count = 0
        updated_budget_costs_item_count = 0

        with transaction.atomic():
            for numer, external_item in enumerate(result_data, start=1):
                purchases_item_id = external_item.get('id')  # ID позиции на goszakupki.by
                num = external_item.get('num')  # Регистрационный номер строки плана
                print(f"  ")
                print(f"__________________________________________________________")
                print(f"[{numer}/{total_plan_item_count}] Обработка позиции {num}")

                if not purchases_item_id or not num:
                    skiped_plan_item_count += 1
                    continue

                local_plan_item = PlanItem.objects.filter(num=num, is_active=True).first()

                if not local_plan_item:
                    local_plan_item = PlanItem.objects.create(plan_purchase=purchase_master,
                                                              num=num,
                                                              is_public=True,
                                                              is_active=True,
                                                              )
                    imported_plan_item_count += 1
                else:
                    updated_plan_item_count += 1

                external_item['plan_item'] = local_plan_item.id
                external_item['purchases_item_id'] = purchases_item_id
                plan_item_serializer = PlanItemDetailImportSerializer(data=external_item)
                plan_item_serializer.is_valid(raise_exception=True)
                plan_item_serializer.save()

                budget_costs_data = external_item.get('budget_costs', [])

                if budget_costs_data:
                    # Обогащаем каждую строку лимита ссылкой на корень plan_item
                    for bc_item in budget_costs_data:
                        bc_item['plan_item'] = local_plan_item.id

                    bc_serializer = BudgetCostsImportSerializer(data=budget_costs_data, many=True)
                    bc_serializer.is_valid(raise_exception=True)
                    saved_bc_objects = bc_serializer.save()

                    for bc_obj in saved_bc_objects:
                        if bc_obj.created_at == bc_obj.changed_at:
                            imported_budget_costs_item_count += 1
                        else:
                            updated_budget_costs_item_count += 1

            print(f"__________________________________________________________")

            external_nums_on_site = {item.get('num') for item in result_data if item.get('num')}
            local_active_plans_qs = PlanItem.objects.filter(
                plan_purchase=purchase_master,
                is_active=True,
                is_public=True,
                num__isnull=False
            ).values_list('id', 'num')

            items_to_extinguish = []

            for local_id, local_num in local_active_plans_qs:
                if local_num not in external_nums_on_site:
                    items_to_extinguish.append(local_id)

            if items_to_extinguish:
                print(f"Казначейский аудит: Найдено исключенных позиций на портале: {len(items_to_extinguish)}")

                with transaction.atomic():
                    # 1. Массово гасим делаем неактивной позицию плана
                    PlanItem.objects.filter(id__in=items_to_extinguish).update(is_active=False)
                    # 2. Массово отправляем в архив (status=ARCHIVE) все связанные текстовые спецификации в ARCHIVE
                    PlanItemDetail.objects.filter(plan_item_id__in=items_to_extinguish).update(status=PlanItemStatus.ARCHIVE)

                    # 3. Массово отправляем в архив (status=ARCHIVE) все связанные финансовые лимиты Минфина
                    BudgetCosts.objects.filter(plan_item_id__in=items_to_extinguish).update(status=PlanItemStatus.ARCHIVE)

                print("Каскадное гашение в ARCHIVE успешно завершено.")
            else:
                print("Казначейский аудит: Все локальные публичные позиции актуальны и присутствуют на портале.")

        return Response({
                    "status": "success",
                    "message": f"Синхронизация с ИС 'Тендеры' успешно завершена.",
                    "details": {
                        "TOTAL_PLAN_ITEM_COUNT": total_plan_item_count,

                        "imported_plan_item_count": imported_plan_item_count,
                        "updated_plan_item_count": updated_plan_item_count,
                        "skiped_plan_item_count": skiped_plan_item_count,

                        "imported_budget_costs_item_count": imported_budget_costs_item_count,
                        "updated_budget_costs_item_count": updated_budget_costs_item_count,
                    }
                }, status=status.HTTP_200_OK)

    else:
        return Response({
            "status": "error",
            "message": f"План закупок {purchase_id} не найден",
        }, status=status.HTTP_404_NOT_FOUND)
