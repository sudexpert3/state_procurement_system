from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, viewsets
from rest_framework.permissions import AllowAny

from procurement.models import Buyer
from procurement.serializers import BuyerSerializer


class BuyerViewSet(viewsets.ModelViewSet):
    """Эндпоинт вывода списка ответственных работников-закупщиков"""
    # Выводим только действующих сотрудников для новых договоров, упорядочивая по алфавиту
    queryset = Buyer.objects.all()
    serializer_class = BuyerSerializer
    permission_classes = [AllowAny]  # Временный режим отладки системы
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    pagination_class = None

    # Поля, по которым фронтенд сможет вести сквозной быстрый поиск в выпадающих списках
    search_fields = ['shot_name', 'full_name',]

    def get_queryset(self):
        queryset = Buyer.objects.all()

        params = self.request.query_params
        print(params)

        is_active = params.get('is_active', 'True').lower() == 'true'
        queryset = queryset.filter(is_active=is_active)

        return queryset