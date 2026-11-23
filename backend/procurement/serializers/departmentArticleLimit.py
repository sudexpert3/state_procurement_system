from rest_framework import serializers

from core.choices import PlanItemStatus
from procurement.models import DepartmentArticleLimit
from procurement.services import department_limits as dl_service

# Поля, которые можно менять ВСЕГДА (на любом статусе) — остальные поля у записи со
# статусом не DRAFT редактировать нельзя (решение пользователя 2026-11-23: смену суммы/
# подразделения/статьи у уже принятого решения делают новой записью + "Активировать", не
# правкой существующей — история версий лимита сохраняется построчно).
ALWAYS_EDITABLE_FIELDS = {'note', 'deactivated_at'}


class DepartmentArticleLimitSerializer(serializers.ModelSerializer):
    """CRUD строки распределения лимита по держателю (Этап «Распределение лимитов»,
    2026-11-23) — прямое редактирование финансистом/админом, без согласования. Черновик
    (status=DRAFT) редактируется целиком; ACTIVE/ARCHIVE — только `note`/`deactivated_at`
    (см. ALWAYS_EDITABLE_FIELDS/validate()). Перевод DRAFT -> ACTIVE — отдельный action
    `activate` (см. views/departmentArticleLimit.py), не через PATCH статуса."""
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
        if instance is not None and instance.status != PlanItemStatus.DRAFT:
            changed = {
                field for field, value in attrs.items()
                if getattr(instance, field, None) != value
            } - ALWAYS_EDITABLE_FIELDS
            if changed:
                raise serializers.ValidationError(
                    f"Запись в статусе «{instance.get_status_display()}» — менять можно только "
                    f"«Примечание»/«Дата деактивации». Для изменения суммы/подразделения/статьи "
                    f"создайте новую запись и активируйте её."
                )
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
