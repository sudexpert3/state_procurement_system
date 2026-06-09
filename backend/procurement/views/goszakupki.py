from django.http import JsonResponse
from django.conf import settings
from api.api import GosZakupkiAPI


def get_purchases_view(request):
    # Инициализируем клиент (данные берутся из settings.py)
    client = GosZakupkiAPI(
        username=settings.GPZ_USERNAME,
        password=settings.GPZ_PASSWORD
    )

    data =None
    page_str = request.GET.get('page', '1')

    try:
        # Пример запроса к гипотетическому эндпоинту закупок
        # data = client.get_data(f"/purchase/all")
        # data = client.get_data(f"/purchase/items/57859?page=2")
        # data = client.get_data(f"/purchase/items/10229") #2019
        # data = client.get_data(f"/purchase/items/25380") #2020
        # data = client.get_data(f"/purchase/items/34105") #2021
        # data = client.get_data(f"/purchase/items/40623") #2022
        # data = client.get_data(f"/purchase/items/42511") #2023
        # data = client.get_data(f"/purchase/items/57859?page={page_str}") #2024
        # data = client.get_data(f"/purchase/items/59258") #2025
        data = client.get_data(f"/purchase/items/68009?page={page_str}") #2026
        # data = client.get_data(f"/purchase/view-item/86808628") # 2024-102377498-578 услуги по разработке ДНК
        # data = client.get_data(f"/purchase/view-item/119050190") # 2026-102377498-15 услуги по питанию
        # data = client.get_data(f"/purchase/budget-cost/86808628") # 2024-102377498-578 услуги по разработке ДНК
        # data = client.get_data("/purchase/budget-cost/119050176")
        # data = client.get_data("/purchase/view-item/119050176")
        return JsonResponse(data, safe=False)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    else:
        if data:
            for item in data:
                print(item)
    finally:
        print('Finish!')
