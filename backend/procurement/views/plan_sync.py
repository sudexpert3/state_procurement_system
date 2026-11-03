from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny

from procurement.services.goszakupki_push import push_plan_items, delete_plan_items


class GosZakupkiPushPlanItemsAPIView(APIView):
    """Отправка одобренных изменений позиций ГПЗ на goszakupki.by — create-item/update-item
    (ТЗ п.3, 16; см. procurement.services.goszakupki_push). Закупщику останется войти в
    личный кабинет на портале, проверить черновик и опубликовать, подписав ЭЦП."""
    permission_classes = [AllowAny]

    def post(self, request):
        plan_item_ids = request.data.get("plan_item_ids", [])
        if not plan_item_ids:
            return Response({"error": "Не переданы plan_item_ids"}, status=status.HTTP_400_BAD_REQUEST)

        result = push_plan_items(plan_item_ids)
        return Response(result, status=status.HTTP_200_OK)


class GosZakupkiDeletePlanItemsAPIView(APIView):
    """Удаление позиций ГПЗ на goszakupki.by — delete-items (исключение позиции из плана)."""
    permission_classes = [AllowAny]

    def post(self, request):
        plan_item_ids = request.data.get("plan_item_ids", [])
        if not plan_item_ids:
            return Response({"error": "Не переданы plan_item_ids"}, status=status.HTTP_400_BAD_REQUEST)

        result = delete_plan_items(plan_item_ids)
        return Response(result, status=status.HTTP_200_OK)
