from rest_framework import serializers

from core.choices import PlanItemStatus
from procurement.models import DepartmentArticleLimit
from procurement.services import department_limits as dl_service

# Поля, которые можно менять ВСЕГДА (на любом статусе) — ARCHIVE-записи (застывшая история)
# редактировать больше нельзя ничем другим. Для ACTIVE-записей (решение пользователя
# 2026-11-26) ограничение шире не нужно: любое поле правится свободно НА УРОВНЕ сериализатора
# — конкретно amount-смена версионируется (архив старой + создание новой ACTIVE) в
# services/department_limits.py::edit_active_limit(), вызываемой из view, а не здесь.
ALWAYS_EDITABLE_FIELDS = {'note', 'deactivated_at'}


class DepartmentArticleLimitSerializer(serializers.ModelSerializer):
    """CRUD строки распределения лимита по держателю (Этап «Распределение лимитов»,
    2026-11-23, доработано 2026-11-26) — прямое редактирование финансистом/админом, без
    согласования. DRAFT — редактируется целиком; ACTIVE — любое поле, кроме суммы (смену
    `amount` версионирует `dl_service.edit_active_limit()`, вызывается из view.update(), не
    отсюда); ARCHIVE — только `note`/`deactivated_at` (см. ALWAYS_EDITABLE_FIELDS/validate()).
    Перевод DRAFT -> ACTIVE — отдельный action `activate` (см. views/departmentArticleLimit.py),
    не через PATCH статуса."""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    functional_code = serializers.CharField(source='functional_class.code_api', read_only=True)
    functional_description = serializers.CharField(source='functional_class.description', read_only=True)
    economic_code = serializers.CharField(source='economic_class.code_api', read_only=True)
    economic_description = serializers.CharField(source='economic_class.description', read_only=True)
    internal_economic_class_code = serializers.CharField(source='internal_economic_class.code', read_only=True)
    internal_economic_class_name = serializers.CharField(source='internal_economic_class.name', read_only=True)
    department_name = serializers.CharField(source='department.short_name', read_only=True)

    # «Сумма позиций в плане» / «сумма факт. оплат» (ТЗ страницы «Распределение лимитов») —
    # не хранятся на модели, считаются по (internal_economic_class, department, year).
    # Листинг (DepartmentArticleLimitViewSet.list()) кладёт карты в context, чтобы не
    # пересчитывать на каждую строку отдельным запросом; если карты в контексте нет (detail/
    # create/update-ответ) — считаем напрямую, по одной записи это не накладно.
    plan_amount = serializers.SerializerMethodField()
    paid_amount = serializers.SerializerMethodField()

    class Meta:
        model = DepartmentArticleLimit
        fields = [
            'id', 'status', 'status_display',
            'functional_class', 'functional_code', 'functional_description',
            'economic_class', 'economic_code', 'economic_description',
            'internal_economic_class', 'internal_economic_class_code', 'internal_economic_class_name',
            'department', 'department_name',
            'year', 'amount', 'note', 'effective_date', 'deactivated_at',
            'plan_amount', 'paid_amount',
            'created_at', 'changed_at',
        ]
        read_only_fields = ['status', 'created_at', 'changed_at']
        # DRF авто-генерирует UniqueTogetherValidator из UniqueConstraint('unique_active_
        # department_limit') — он проверяет условие `status=ACTIVE` ПО ЗНАЧЕНИЮ ИЗ ATTRS, а
        # `status` у нас read_only (меняется только через activate()/edit_active_limit()), из-
        # за чего валидатор видит значение по умолчанию модели (DRAFT), а не реальный статус
        # правящейся записи — ложно пропускает или ложно блокирует коллизию в разных сценариях.
        # Уникальность ACTIVE-связки проверяется вручную в services/department_limits.py
        # (`edit_active_limit`/`activate_limit`, через full_clean()/IntegrityError с понятным
        # сообщением) — здесь он не нужен и мешает архивации+созданию новой версии при смене
        # суммы (см. CurrentStatus.md, 2026-11-26).
        validators = []

    def get_plan_amount(self, obj):
        plan_map = self.context.get('plan_amount_map')
        key = (obj.internal_economic_class_id, obj.department_id, obj.year)
        if plan_map is not None:
            return plan_map.get(key, 0)
        return dl_service.compute_reserved_by_plan_share(*key)

    def get_paid_amount(self, obj):
        paid_map = self.context.get('paid_amount_map')
        key = (obj.internal_economic_class_id, obj.department_id, obj.year)
        if paid_map is not None:
            return paid_map.get(key, 0)
        return dl_service.compute_paid_actual_by_department(*key)

    def validate(self, attrs):
        instance = self.instance
        if instance is not None and instance.status == PlanItemStatus.ARCHIVE:
            changed = {
                field for field, value in attrs.items()
                if getattr(instance, field, None) != value
            } - ALWAYS_EDITABLE_FIELDS
            if changed:
                raise serializers.ValidationError(
                    f"Запись в статусе «{instance.get_status_display()}» — менять можно только "
                    f"«Примечание»/«Дата деактивации», это архивная история версии лимита."
                )
        # DRAFT — редактируется целиком, как и раньше. ACTIVE — тоже любое поле, но смену
        # amount обрабатывает edit_active_limit() на уровне view/сервиса (архивация старой +
        # создание новой ACTIVE), не этот сериализатор.
        return attrs


class ArticleAvailabilitySerializer(serializers.Serializer):
    """Ответ `GET .../article_availability/` — для живого предупреждения о перерасходе в
    модалке (см. views/departmentArticleLimit.py)."""
    functional_class = serializers.IntegerField()
    economic_class = serializers.IntegerField()
    year = serializers.IntegerField()
    available_limit = serializers.DecimalField(max_digits=15, decimal_places=2)
    allocated_total = serializers.DecimalField(max_digits=15, decimal_places=2)
    remaining = serializers.DecimalField(max_digits=15, decimal_places=2)


class OverspendSummaryLineSerializer(serializers.Serializer):
    """Одна строка ответа `GET .../overspend_summary/` — для баннера перерасхода на
    странице «Распределение лимитов»."""
    functional_class = serializers.IntegerField()
    functional_code = serializers.CharField(allow_null=True)
    economic_class = serializers.IntegerField()
    economic_code = serializers.CharField(allow_null=True)
    year = serializers.IntegerField()
    available_limit = serializers.DecimalField(max_digits=15, decimal_places=2)
    allocated_total = serializers.DecimalField(max_digits=15, decimal_places=2)
    overspend_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
