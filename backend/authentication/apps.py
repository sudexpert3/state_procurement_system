from django.apps import AppConfig


class AuthenticationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'authentication'
    verbose_name = 'Пользователи и роли'

    def ready(self):
        from . import signals  # noqa: F401 — регистрирует post_save-обработчик
