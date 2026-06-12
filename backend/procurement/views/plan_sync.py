from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny
from procurement.services.goszakupki_api import GosZakupkiAPIService


class GosZakupkiPushDraftAPIView(APIView):
    """Вызов отправки подготовленного проекта изменений на goszakupki.by"""
    permission_classes = [AllowAny]

    def post(self, request):
        plan_ids = request.data.get("plan_ids", [])
        if not plan_ids:
            return Response({"error": "Не выбраны пункты плана для отправки"}, status=status.HTTP_400_BAD_REQUEST)

        service = GosZakupkiAPIService()
        result = service.send_draft_changes(plan_ids)
        return Response(result, status=status.HTTP_200_OK)


class GosZakupkiPullActualAPIView(APIView):
    """Синхронизация локальной СУБД с опубликованным на портале планом"""
    permission_classes = [AllowAny]

    def get(self, request):
        unp = request.query_params.get("unp")
        if not unp:
            return Response({"error": "Не передан УНП организации ГКСЭ"}, status=status.HTTP_400_BAD_REQUEST)

        service = GosZakupkiAPIService()
        result = service.pull_actual_published_plans(unp)
        return Response(result, status=status.HTTP_200_OK)
