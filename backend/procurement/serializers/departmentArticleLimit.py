from rest_framework import serializers

from procurement.models import DepartmentArticleLimit


class DepartmentArticleLimitSerializer(serializers.ModelSerializer):
    """CRUD черновика калибровки (Этап, kind=DEPARTMENT_LIMIT_CALIBRATION) — специалист
    добавляет/правит/удаляет строки подстатей (department=null) и держателей (department
    заполнен) через обычный REST, затем смотрит сверку через
    /api/change_requests/{id}/forecast/ (переиспользует общий движок, Этап 2)."""
    functional_code = serializers.CharField(source='functional_class.code_api', read_only=True)
    economic_code = serializers.CharField(source='economic_class.code_api', read_only=True)
    internal_economic_class_code = serializers.CharField(source='internal_economic_class.code', read_only=True)
    department_name = serializers.CharField(source='department.short_name', read_only=True, default=None)

    class Meta:
        model = DepartmentArticleLimit
        fields = [
            'id', 'status', 'functional_class', 'functional_code', 'economic_class', 'economic_code',
            'internal_economic_class', 'internal_economic_class_code', 'department', 'department_name',
            'year', 'amount', 'change_request', 'created_at', 'changed_at',
        ]
