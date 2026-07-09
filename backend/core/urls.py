"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from django.conf import settings
from procurement.views import (PurchasesViewSet,
                               PlanItemViewSet, UnitOfMeasurementViewSet, OkrbProductViewSet,
                               BudgetCostsViewSet, FunctionalCodeViewSet, ExternalEconomicCodeViewSet,
                               InternalEconomicClassifierViewSet, ProgramCodeViewSet,
                               ContractViewSet, SupplierViewSet, BuyerViewSet, ProcurementMethodDetailViewSet,
                               TreasuryPaymentViewSet,
                               DepartmentViewSet,
                               GosZakupkiPushDraftAPIView, GosZakupkiPullActualAPIView, PlanItemDetailViewSet
                               )
from procurement.views import (get_purchases_view, get_purchases_items, get_data_gpz)

from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView

router = DefaultRouter()
router.register(r'purchases', PurchasesViewSet, basename='purchases')
router.register(r'plan_items', PlanItemViewSet, basename='plan_items')
router.register(r'plan_items_details', PlanItemDetailViewSet, basename='plan_items_details')
router.register(r'units_of_measurement', UnitOfMeasurementViewSet, basename='unit_of_measurement')
router.register(r'okrb', OkrbProductViewSet, basename='okrb')
router.register(r'budget_costs', BudgetCostsViewSet, basename='budget_costs')
router.register(r'functional_code', FunctionalCodeViewSet, basename='functional_code')
router.register(r'economic_code', ExternalEconomicCodeViewSet, basename='economic_code')
router.register(r'internal_economic_code', InternalEconomicClassifierViewSet, basename='internal_economic_classifier')
router.register(r'program_code', ProgramCodeViewSet, basename='program_code')
router.register(r'contracts', ContractViewSet, basename='contracts')
router.register(r'suppliers', SupplierViewSet, basename='suppliers')
router.register(r'buyers', BuyerViewSet, basename='buyers')
router.register(r'procurement_methods', ProcurementMethodDetailViewSet, basename='procurement_methods')
router.register(r'payments', TreasuryPaymentViewSet, basename='payments')
router.register(r'departments', DepartmentViewSet, basename='departments')


# router.register(r'api_purchases', PurchasesViewSet, basename='api_purchases')

urlpatterns = [
    path('admin/', admin.site.urls),

    # Временно комментируем Djoser
    # path('api/auth/', include('djoser.urls')),
    # path('api/auth/', include('djoser.urls.jwt')),

    # Скачивание схемы в формате YAML (из неё будем делать типы)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    # Интерактивная документация Swagger для обсуждения с фронтендером
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),

    path('api/gosakupki/get_purchases_all', get_purchases_view, name='get_purchases_all'),
    path('api/gosakupki/get_purchases_items/<int:purchase_id>/', get_purchases_items, name='get_purchases_items'),
    path('api/gosakupki/get_gpz/<int:purchase_id>/', get_data_gpz, name='get_data_gpz'),

    path('api/goszakupki/push-draft/', GosZakupkiPushDraftAPIView.as_view(), name='gz-push-draft'),
    path('api/goszakupki/pull-actual/', GosZakupkiPullActualAPIView.as_view(), name='gz-pull-actual'),

    path('api/', include(router.urls)),
]

# Добавляем раздачу медиа-файлов (только для разработки)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
