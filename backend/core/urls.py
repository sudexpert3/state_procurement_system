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
from procurement.views import (get_purchases_view, ContractViewSet, SupplierViewSet, ProcurementMethodDetailViewSet,
                               TreasuryPaymentViewSet, BuyerViewSet, BudgetCostsViewSet, UnitOfMeasurementViewSet, DepartmentViewSet,
                               GosZakupkiPushDraftAPIView, GosZakupkiPullActualAPIView)
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


router = DefaultRouter()
router.register(r'contracts', ContractViewSet, basename='contract')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'procurement_methods', ProcurementMethodDetailViewSet, basename='procurement_method')
router.register(r'payments', TreasuryPaymentViewSet, basename='payment')
router.register(r'buyers', BuyerViewSet, basename='buyer')
router.register(r'budget_costs', BudgetCostsViewSet, basename='budget_cost')
router.register(r'units_of_measurement', UnitOfMeasurementViewSet, basename='unit_of_measurement')
router.register(r'departments', DepartmentViewSet, basename='department')


urlpatterns = [
    path('admin/', admin.site.urls),

    # Временно комментируем Djoser
    # path('api/auth/', include('djoser.urls')),
    # path('api/auth/', include('djoser.urls.jwt')),

    path('gpz/', get_purchases_view, name='get_gpz'),

    path('api/', include(router.urls)),
    # Скачивание схемы в формате YAML (из неё будем делать типы)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    # Интерактивная документация Swagger для обсуждения с фронтендером
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),

path('api/goszakupki/push-draft/', GosZakupkiPushDraftAPIView.as_view(), name='gz-push-draft'),
path('api/goszakupki/pull-actual/', GosZakupkiPullActualAPIView.as_view(), name='gz-pull-actual'),
]

# Добавляем раздачу медиа-файлов (только для разработки)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
