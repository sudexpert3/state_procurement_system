from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from core.choices import UserRoleType
from procurement.models import Buyer

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """CRUD пользователей (`/api/users/`, доступ — только роль ADMIN_MAIN, см.
    `procurement/permissions.py`) и представление текущего пользователя (`/api/auth/me/`).

    Роль и связанный закупщик физически лежат в `UserProfile` (OneToOne), но наружу
    отдаются как плоские поля — фронтенду не нужно знать про это разделение. DRF сам
    строит/разбирает вложенный `profile.*` по `source=` с точкой (см. `set_value()` в
    `rest_framework.fields`) — поэтому в `create()`/`update()` работаем с
    `validated_data['profile']`, а не с отдельными ключами `role`/`buyer`.
    """
    role = serializers.ChoiceField(source='profile.role', choices=UserRoleType.choices)
    role_display = serializers.CharField(source='profile.get_role_display', read_only=True)
    buyer = serializers.PrimaryKeyRelatedField(
        source='profile.buyer', queryset=Buyer.objects.all(), allow_null=True, required=False,
    )
    # Пароль — только при создании/смене; никогда не отдаётся обратно.
    password = serializers.CharField(write_only=True, required=False, validators=[validate_password])

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 'email', 'is_active',
            'role', 'role_display', 'buyer', 'password', 'date_joined', 'last_login',
        ]
        read_only_fields = ['date_joined', 'last_login']

    def create(self, validated_data):
        profile_data = validated_data.pop('profile', {})
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError({'password': 'Пароль обязателен при создании пользователя.'})

        user = User(**validated_data)
        user.set_password(password)
        user.save()
        # Профиль с дефолтной ролью уже создан сигналом (authentication.signals) и закэширован
        # на этом же объекте user — мутируем ЕГО ЖЕ (а не отдельным update_or_create), иначе
        # последующий user.profile (в т.ч. при сериализации ответа) отдал бы устаревший
        # закэшированный объект с дефолтной ролью/без закупщика (найдено тестом).
        self._apply_profile_data(user.profile, profile_data)
        return user

    def update(self, instance, validated_data):
        profile_data = validated_data.pop('profile', {})
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        if profile_data:
            self._apply_profile_data(instance.profile, profile_data)
        return instance

    @staticmethod
    def _apply_profile_data(profile, profile_data):
        for attr, value in profile_data.items():
            setattr(profile, attr, value)
        profile.save()
