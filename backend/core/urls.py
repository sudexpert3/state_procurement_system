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
from procurement.views import get_purchases_view
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView


router = DefaultRouter()
# router.register(r'getgpz', get_purchases_view)

urlpatterns = [
    path('admin/', admin.site.urls),

    # Временно комментируем Djoser
    # path('api/auth/', include('djoser.urls')),
    # path('api/auth/', include('djoser.urls.jwt')),

    # path('api/', include(router.urls)),
    path('gpz/', get_purchases_view, name='get_gpz'),

    # Скачивание схемы в формате YAML (из неё будем делать типы)
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    # Интерактивная документация Swagger для обсуждения с фронтендером
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
]

# Добавляем раздачу медиа-файлов (только для разработки)
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
