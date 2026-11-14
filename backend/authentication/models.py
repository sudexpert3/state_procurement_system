from django.conf import settings
from django.db import models

from core.choices import UserRoleType


class UserProfile(models.Model):
    """Роль и дополнительные данные пользователя — вынесены в отдельную модель, а не в
    кастомный User (AbstractUser), т.к. проект уже вёлся на стандартном django.contrib.auth.User
    (1 суперпользователь + 408 строк django_admin_log, ссылающихся на auth_user) — подмена
    AUTH_USER_MODEL задним числом требует рискованной миграции физической таблицы без
    видимой пользы для текущих задач (Этап 7, 2026-11-14). Этот паттерн (OneToOne-профиль)
    даёт то же самое (роль + связь с закупщиком) без риска для уже существующих данных.
    """
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile',
        verbose_name="Пользователь",
    )
    role = models.CharField(
        "Роль", max_length=32, choices=UserRoleType.choices,
        default=UserRoleType.PURCHASING_SPECIALIST, db_index=True,
    )
    # Связь с существующим справочником закупщиков (procurement.Buyer) — решение пользователя
    # 2026-11-14: "назначено этому закупщику" (PlanItemDetail.buyer) должно резолвиться в
    # "видно в кабинете этого пользователя" без задвоения сущности. Заполняется только для
    # ролей, которым это осмысленно (PURCHASING_SPECIALIST/MAIN_PURCHASER) — не обязательное
    # поле на уровне модели, т.к. у FINANCIER/HEAD/ADMIN_MAIN привязки к Buyer нет и не будет.
    buyer = models.OneToOneField(
        'procurement.Buyer', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='user_account', verbose_name="Связанный закупщик",
    )

    class Meta:
        verbose_name = "Профиль пользователя"
        verbose_name_plural = "Профили пользователей"

    def __str__(self):
        return f"{self.user.username} ({self.get_role_display()})"
