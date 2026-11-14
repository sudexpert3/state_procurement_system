from django.conf import settings
from django.db import migrations


def backfill_superuser_profiles(apps, schema_editor):
    """Существующие суперпользователи (createsuperuser, до Этапа 7) получают профиль с ролью
    ADMIN_MAIN — иначе request.user.profile падал бы DoesNotExist для аккаунтов, созданных
    до появления сигнала authentication.signals.ensure_user_profile."""
    User = apps.get_model(settings.AUTH_USER_MODEL)
    UserProfile = apps.get_model('authentication', 'UserProfile')
    for user in User.objects.filter(is_superuser=True):
        UserProfile.objects.get_or_create(user=user, defaults={'role': 'ADMIN_MAIN'})


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('authentication', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(backfill_superuser_profiles, noop),
    ]
