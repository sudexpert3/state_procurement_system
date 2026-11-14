from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin

from .models import UserProfile

User = get_user_model()


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False
    verbose_name_plural = "Роль ГКСЭ"


class CustomUserAdmin(UserAdmin):
    inlines = [UserProfileInline]
    list_display = UserAdmin.list_display + ('get_role',)

    @admin.display(description="Роль")
    def get_role(self, obj):
        profile = getattr(obj, 'profile', None)
        return profile.get_role_display() if profile else '—'


admin.site.unregister(User)
admin.site.register(User, CustomUserAdmin)
