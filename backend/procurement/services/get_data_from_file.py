import json
import os

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response


def get_API_data(file_name=None):
    if not file_name:
        return Response(
            {"error": f"Не указан тестовый файл"},
            status=status.HTTP_404_NOT_FOUND
        )

    result_data = []
    file_path = os.path.join(settings.BASE_DIR, 'procurement', 'data', file_name)
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            result_data = json.load(f)
    except FileNotFoundError:
        return Response(
            {"error": f"Тестовый файл не найден по пути: {file_path}"},
            status=status.HTTP_404_NOT_FOUND
        )
    except json.JSONDecodeError:
        return Response(
            {"error": "Ошибка синтаксиса JSON в тестовом файле. Проверьте запятые и скобки."},
            status=status.HTTP_400_BAD_REQUEST
        )

    return result_data
