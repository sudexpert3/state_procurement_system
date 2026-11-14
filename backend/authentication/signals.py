from django.contrib.auth import get_user_model
from django.db.models.signals import post_save
from django.dispatch import receiver

from core.choices import UserRoleType
from .models import UserProfile

User = get_user_model()


@receiver(post_save, sender=User)
def ensure_user_profile(sender, instance, created, **kwargs):
    """Любой новый пользователь — через /api/users/, `createsuperuser` или /admin/ — получает
    профиль автоматически. Без этого `request.user.profile` падал бы `DoesNotExist` для
    аккаунтов, созданных не через наш `UserSerializer` (например, `createsuperuser`)."""
    if created:
        UserProfile.objects.get_or_create(
            user=instance,
            defaults={
                'role': UserRoleType.ADMIN_MAIN if instance.is_superuser else UserRoleType.PURCHASING_SPECIALIST,
            },
        )
