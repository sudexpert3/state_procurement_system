"""
Централизованная карта "кто что может" по ролям (core.choices.UserRoleType).

Роли и правила видимости ещё будут меняться (решение пользователя, Этап 7, 2026-11-14) —
поэтому вся логика собрана в ОДНОМ месте, а не размазана по permission_classes каждого
вьюсета. Чтобы поменять правило в будущем — правим CAPABILITIES здесь, а не ищем по всему
проекту.

На момент 2026-11-14 реально используется только 'manage_users' — остальные ~20 вьюсетов
(позиции плана, договоры, платежи, отчёты и т.д.) по решению пользователя остаются AllowAny
в этом проходе (см. REST_FRAMEWORK.DEFAULT_PERMISSION_CLASSES в core/settings.py).
Расширение этой карты под каждый из них — отдельный следующий шаг, использующий тот же
has_capability().
"""
from rest_framework.permissions import BasePermission

from core.choices import UserRoleType

CAPABILITIES = {
    'manage_users': {UserRoleType.ADMIN_MAIN},
}


def role_has_capability(role, capability):
    return role in CAPABILITIES.get(capability, set())


def has_capability(capability):
    """Фабрика DRF permission-класса: `permission_classes = [has_capability('manage_users')]`.
    Суперпользователь (createsuperuser/`/admin/`) — всегда True, независимо от role, т.к.
    is_superuser исторически уже означает полный доступ в Django."""

    class _HasCapability(BasePermission):
        def has_permission(self, request, view):
            user = request.user
            if not user or not user.is_authenticated:
                return False
            if user.is_superuser:
                return True
            profile = getattr(user, 'profile', None)
            return bool(profile) and role_has_capability(profile.role, capability)

    _HasCapability.__name__ = f"HasCapability_{capability}"
    return _HasCapability
