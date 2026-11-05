from rest_framework import viewsets, status, filters
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.db import transaction
from django_filters.rest_framework import DjangoFilterBackend

from procurement.models.budgetCosts import BudgetCosts
from procurement.serializers import BudgetCostsImportSerializer, BudgetCostsSerializer  # Укажите ваш относительный или абсолютный путь


class BudgetCostsViewSet(viewsets.ModelViewSet):
    """
    Эндпоинт для пакетного импорта и распределения годового финансового обеспечения закупки.
    Принимает сырые коды казначейства и автоматически увязывает их с иерархией ЭКР ГКСЭ.
    """
    queryset = BudgetCosts.objects.all().select_related(
        'functional_class', 'program_class', 'economic_class', 'plan_item',
        'internal_economic_class', 'internal_economic_section', 'internal_economic_subsection',
        'internal_economic_kind', 'internal_economic_article'
    )

    serializer_class = BudgetCostsSerializer
    permission_classes = [AllowAny]  # Временный отладочный режим системы без авторизации
    filter_backends = [DjangoFilterBackend, filters.SearchFilter]
    filterset_fields = ['year', 'purchases_items_id', 'budget_code', 'status', 'change_request', 'plan_item']
    # Поиск по номеру позиции плана (?search=2026-102377498-117) — запрошено фронтом для
    # формы перераспределения лимита (doc/frontend_handoff.md, раздел 3.1).
    search_fields = ['plan_item__num']

    def create(self, request, *args, **kwargs):
        """
        Кастомизированный метод POST.
        Поддерживает передачу как одной финансовой строки {}, так и массива [{}, {}].
        Исполняется строго в атомарной транзакции базы данных.
        """
        # Определяем, прилетел ли нам список объектов для пакетного импорта
        is_many = isinstance(request.data, list)

        serializer = self.get_serializer(data=request.data, many=is_many)
        serializer.is_valid(raise_exception=True)

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
