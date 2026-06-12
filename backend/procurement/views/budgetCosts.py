from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend

from procurement.models.budgetCosts import BudgetCosts
from procurement.serializers import BudgetCostsImportSerializer  # Укажите ваш относительный или абсолютный путь


class BudgetCostsViewSet(viewsets.ModelViewSet):
    """
    Эндпоинт для пакетного импорта и распределения годового финансового обеспечения закупки.
    Принимает сырые коды казначейства и автоматически увязывает их с иерархией ЭКР ГКСЭ.
    """
    queryset = BudgetCosts.objects.all().select_related(
        'functional_class', 'program_class', 'external_economic_class',
        'economic_class', 'economic_section', 'economic_subsection',
        'economic_kind', 'economic_article'
    )
    serializer_class = BudgetCostsImportSerializer
    permission_classes = [AllowAny]  # Временный отладочный режим системы без авторизации
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['year', 'purchases_items_id', 'budget_code']

    def create(self, request, *args, **kwargs):
        """
        Кастомизированный метод POST.
        Поддерживает передачу как одной финансовой строки {}, так и массива [{}, {}].
        Исполняется строго в атомарной транзакции базы данных.
        """
        # Определяем, прилетел ли нам список объектов для пакетного импорта
        is_many = isinstance(request.data, list)

        serializer = self.get_serializer(data=request.data, many=is_many)
        serializer.is_is_valid(raise_exception=True)

        try:
            # Обертываем запись в транзакцию: если хоть один сырой код в пакете вызовет сбой,
            # PostgreSQL откатит весь пакет, исключив частичное замусоривание финансовой базы
            with transaction.atomic():
                self.perform_create(serializer)

            headers = self.get_success_headers(serializer.data)
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED,
                headers=headers
            )
        except Exception as e:
            return Response(
                {"error": f"Казначейский сбой при пакетной обработке лимитов: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
