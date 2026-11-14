from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from procurement.permissions import has_capability
from .serializers import UserSerializer

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    """Управление пользователями — доступно только роли ADMIN_MAIN (единственная роль с
    правом "Создание пользователей и их администрирование", см. core/choices.py)."""
    queryset = User.objects.select_related('profile', 'profile__buyer').all().order_by('username')
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, has_capability('manage_users')]


class MeAPIView(APIView):
    """Текущий пользователь (включая роль) — фронтенду нужно знать роль, чтобы показывать
    нужные разделы/кнопки (см. frontend/docs/CurrentStatus.md, запись про buyer_detail от
    2026-11-06 — тот же класс проблемы: без этого эндпоинта фронт не мог узнать роль)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(responses=UserSerializer)
    def get(self, request):
        return Response(UserSerializer(request.user).data)
