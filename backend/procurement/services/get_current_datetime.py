from django.utils import timezone


def get_current_datetime():
    """Динамическое получение текущих даты и времени"""
    return timezone.now()


def get_current_date():
    """Динамическое вычисление текущей даты"""
    return timezone.now().date()


def get_current_year():
    """Динамическое вычисление текущего календарного года без фиксации в памяти"""
    return timezone.now().year
