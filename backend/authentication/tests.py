from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIRequestFactory

from core.choices import UserRoleType
from procurement.models import Buyer
from procurement.permissions import has_capability
from .models import UserProfile
from .serializers import UserSerializer

User = get_user_model()


class UserProfileSignalTestCase(TestCase):
    """Этап 7 (2026-11-14): любой новый User должен автоматически получить UserProfile —
    иначе request.user.profile падал бы DoesNotExist для аккаунтов, созданных не через
    наш UserSerializer (например, createsuperuser)."""

    def test_regular_user_gets_default_role(self):
        user = User.objects.create_user(username='u1', password='x')
        self.assertEqual(user.profile.role, UserRoleType.PURCHASING_SPECIALIST)

    def test_superuser_gets_admin_main_role(self):
        user = User.objects.create_superuser(username='root1', password='x', email='r@example.com')
        self.assertEqual(user.profile.role, UserRoleType.ADMIN_MAIN)

    def test_saving_existing_user_again_does_not_touch_profile(self):
        user = User.objects.create_user(username='u2', password='x')
        user.profile.role = UserRoleType.FINANCIER
        user.profile.save()
        user.first_name = 'Иван'
        user.save()  # created=False — сигнал не должен трогать уже существующий профиль
        user.refresh_from_db()
        self.assertEqual(user.profile.role, UserRoleType.FINANCIER)


class UserSerializerTestCase(TestCase):
    """CRUD пользователей (/api/users/) — роль и закупщик физически лежат в UserProfile,
    но наружу отдаются как плоские поля role/buyer (см. docstring UserSerializer)."""

    def setUp(self):
        self.buyer = Buyer.objects.create(shot_name='Иванов И.И.', full_name='Иванов Иван Иванович')

    def test_create_requires_password(self):
        serializer = UserSerializer(data={'username': 'nopass', 'role': UserRoleType.HEAD})
        self.assertTrue(serializer.is_valid(), serializer.errors)
        with self.assertRaises(ValidationError):
            serializer.save()

    def test_create_sets_role_and_buyer(self):
        serializer = UserSerializer(data={
            'username': 'buyer_acc', 'password': 'StrongPass123!',
            'role': UserRoleType.PURCHASING_SPECIALIST, 'buyer': self.buyer.pk,
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
        user = serializer.save()
        self.assertTrue(user.check_password('StrongPass123!'))
        self.assertEqual(user.profile.role, UserRoleType.PURCHASING_SPECIALIST)
        self.assertEqual(user.profile.buyer_id, self.buyer.pk)

    def test_partial_update_role_only_does_not_require_password(self):
        user = User.objects.create_user(username='existing', password='x')
        serializer = UserSerializer(user, data={'role': UserRoleType.FINANCIER}, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        user.refresh_from_db()
        self.assertEqual(user.profile.role, UserRoleType.FINANCIER)

    def test_representation_includes_role_display_and_no_password(self):
        user = User.objects.create_user(username='repr_test', password='x')
        data = UserSerializer(user).data
        self.assertEqual(data['role'], UserRoleType.PURCHASING_SPECIALIST)
        self.assertIn('role_display', data)
        self.assertNotIn('password', data)


class HasCapabilityPermissionTestCase(TestCase):
    """procurement/permissions.py::has_capability — единая точка проверки прав (см. её
    docstring про то, что роли/права ещё будут меняться)."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.permission_cls = has_capability('manage_users')()

    def _request_as(self, user):
        request = self.factory.get('/api/users/')
        request.user = user
        return request

    def test_anonymous_denied(self):
        from django.contrib.auth.models import AnonymousUser
        self.assertFalse(self.permission_cls.has_permission(self._request_as(AnonymousUser()), None))

    def test_role_without_capability_denied(self):
        user = User.objects.create_user(username='head1', password='x')
        user.profile.role = UserRoleType.HEAD
        user.profile.save()
        self.assertFalse(self.permission_cls.has_permission(self._request_as(user), None))

    def test_role_with_capability_allowed(self):
        user = User.objects.create_user(username='admin_role', password='x')
        user.profile.role = UserRoleType.ADMIN_MAIN
        user.profile.save()
        self.assertTrue(self.permission_cls.has_permission(self._request_as(user), None))

    def test_superuser_always_allowed_regardless_of_role(self):
        user = User.objects.create_superuser(username='root2', password='x', email='r2@example.com')
        user.profile.role = UserRoleType.HEAD  # роль неважна — is_superuser решает
        user.profile.save()
        self.assertTrue(self.permission_cls.has_permission(self._request_as(user), None))


class EditContractsCapabilityTestCase(TestCase):
    """Запрос пользователя (2026-11-18): редактировать реестр договоров могут только
    «Главный администратор» и «Финансист» (см. CAPABILITIES['edit_contracts'],
    ContractViewSet.get_permissions()). Проверяем именно эту пару ролей — в отличие от
    manage_users (только ADMIN_MAIN), здесь допущена ещё и FINANCIER."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.permission_cls = has_capability('edit_contracts')()

    def _request_as(self, user):
        request = self.factory.patch('/api/contracts/1/')
        request.user = user
        return request

    def test_financier_allowed(self):
        user = User.objects.create_user(username='financier1', password='x')
        user.profile.role = UserRoleType.FINANCIER
        user.profile.save()
        self.assertTrue(self.permission_cls.has_permission(self._request_as(user), None))

    def test_admin_main_allowed(self):
        user = User.objects.create_user(username='admin_role2', password='x')
        user.profile.role = UserRoleType.ADMIN_MAIN
        user.profile.save()
        self.assertTrue(self.permission_cls.has_permission(self._request_as(user), None))

    def test_other_roles_denied(self):
        user = User.objects.create_user(username='purchaser1', password='x')
        user.profile.role = UserRoleType.PURCHASING_SPECIALIST
        user.profile.save()
        self.assertFalse(self.permission_cls.has_permission(self._request_as(user), None))

    def test_anonymous_denied(self):
        from django.contrib.auth.models import AnonymousUser
        self.assertFalse(self.permission_cls.has_permission(self._request_as(AnonymousUser()), None))


class BudgetLimitCorrectionCapabilityTestCase(TestCase):
    """Запрос пользователя (2026-11-20): импорт корректировки лимитов из файла fin_YYYY.xlsb
    (страница "Общие деньги") доступен только «Главному администратору» и «Финансисту» —
    та же пара ролей, что и у edit_contracts (см. CAPABILITIES['budget_limit_correction'],
    ChangeRequestViewSet.get_permissions())."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.permission_cls = has_capability('budget_limit_correction')()

    def _request_as(self, user):
        request = self.factory.post('/api/change_requests/budget_limit_correction/')
        request.user = user
        return request

    def test_financier_allowed(self):
        user = User.objects.create_user(username='financier2', password='x')
        user.profile.role = UserRoleType.FINANCIER
        user.profile.save()
        self.assertTrue(self.permission_cls.has_permission(self._request_as(user), None))

    def test_admin_main_allowed(self):
        user = User.objects.create_user(username='admin_role3', password='x')
        user.profile.role = UserRoleType.ADMIN_MAIN
        user.profile.save()
        self.assertTrue(self.permission_cls.has_permission(self._request_as(user), None))

    def test_other_roles_denied(self):
        user = User.objects.create_user(username='purchaser2', password='x')
        user.profile.role = UserRoleType.PURCHASING_SPECIALIST
        user.profile.save()
        self.assertFalse(self.permission_cls.has_permission(self._request_as(user), None))

    def test_anonymous_denied(self):
        from django.contrib.auth.models import AnonymousUser
        self.assertFalse(self.permission_cls.has_permission(self._request_as(AnonymousUser()), None))


class DepartmentLimitsCapabilityTestCase(TestCase):
    """Решение пользователя (2026-11-23): страница «Распределение лимитов» доступна только
    «Главному администратору» и «Финансисту» — та же пара ролей, что и у
    budget_limit_correction (см. CAPABILITIES['department_limits'],
    DepartmentArticleLimitViewSet.get_permissions())."""

    def setUp(self):
        self.factory = APIRequestFactory()
        self.permission_cls = has_capability('department_limits')()

    def _request_as(self, user):
        request = self.factory.get('/api/department_article_limits/')
        request.user = user
        return request

    def test_financier_allowed(self):
        user = User.objects.create_user(username='financier_dl_cap', password='x')
        user.profile.role = UserRoleType.FINANCIER
        user.profile.save()
        self.assertTrue(self.permission_cls.has_permission(self._request_as(user), None))

    def test_admin_main_allowed(self):
        user = User.objects.create_user(username='admin_dl_cap', password='x')
        user.profile.role = UserRoleType.ADMIN_MAIN
        user.profile.save()
        self.assertTrue(self.permission_cls.has_permission(self._request_as(user), None))

    def test_other_roles_denied(self):
        user = User.objects.create_user(username='purchaser_dl_cap', password='x')
        user.profile.role = UserRoleType.PURCHASING_SPECIALIST
        user.profile.save()
        self.assertFalse(self.permission_cls.has_permission(self._request_as(user), None))

    def test_anonymous_denied(self):
        from django.contrib.auth.models import AnonymousUser
        self.assertFalse(self.permission_cls.has_permission(self._request_as(AnonymousUser()), None))
