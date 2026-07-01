from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import (BudgetCosts, Buyer, Contract, ContractItem, Supplier, ContractQuarterlyFinance, \
                     Department, InternalEconomicClassifier, ExternalEconomicCode, FunctionalCode, OkrbProduct, \
                     PlanItem, PlanItemDetail, PlanShare, ProcurementMethodDetail, ProgramCode, \
                     TreasuryPayment, UnitOfMeasurement, Purchases)


# @admin.register(CustomUser)
# class CustomUserAdmin(UserAdmin):
#     """Настройка отображения пользователей ведомства в Django-админке"""
#     model = CustomUser
#
#     # Списки полей, отображаемые в таблице реестра пользователей
#     list_display = ['username', 'email', 'role', 'organization', 'department', 'is_staff', 'is_active']
#     list_filter = ['role', 'is_staff', 'is_active', 'organization', 'department']
#
#     # Добавляем наши ведомственные поля в формы редактирования пользователя
#     fieldsets = UserAdmin.fieldsets + (
#         ('Ведомственные данные ГКСЭ', {
#             'fields': ('role', 'organization', 'department', 'phone')
#         }),
#     )
#
#     # Добавляем поля в форму создания нового пользователя
#     add_fieldsets = UserAdmin.add_fieldsets + (
#         ('Ведомственные данные ГКСЭ', {
#             'fields': ('role', 'organization', 'department', 'phone')
#         }),
#     )

@admin.register(Purchases)
class PurchasesAdmin(admin.ModelAdmin):
    list_display = ["purchase_id", "purchase_num", "year", "date_added", "date_edit", "date_sign", "is_draft"]
    search_fields = ["purchase_id", "purchase_num", "year"]
    list_filter = ("year", "is_draft",)


@admin.register(PlanItem)
class PlanItemAdmin(admin.ModelAdmin):
    # list_display = ["num", "is_public", "is_active", "purchase", "created_at", "updated_at"]
    list_display = ["num", "is_public", "is_active", "created_at", "updated_at"]
    search_fields = ["num",]
    # list_filter = ("is_public", "is_active", "purchase",)
    list_filter = ("is_public", "is_active",)


@admin.register(PlanItemDetail)
class PlanItemDetailAdmin(admin.ModelAdmin):
    list_display = ["purchases_item_id", "plan_item", "title", "okrb", "type", "val_unit", "val_amount", "val_currency", "procedure_months",
                    "status", "created_at", "changed_at"]
    search_fields = ["okrb", "type"]
    list_filter = ("type", "status", "okrb",)


@admin.register(PlanShare)
class PlanShareAdmin(admin.ModelAdmin):
    list_display = ["budget_cost", "department", "shared_amount", "shared_cost"]
    list_filter = ("department",)


@admin.register(BudgetCosts)
class BudgetCostsAdmin(admin.ModelAdmin):
    list_display = ["year", "purchases_items_id", "cost", "functional_class",
                    "economic_class", "program_class", "internal_economic_class", "internal_economic_section",
                    "internal_economic_subsection",
                    "internal_economic_kind", "internal_economic_article"]
    list_filter = ("year", "functional_class", "economic_class", "internal_economic_class")


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ["number", "contract_date", "supplier", "total_cost", "buyer", "parent_contract",
                    "is_registered_in_treasury",
                    "payment_terms", "planned_delivery_date", "notice", "fixed_assets_plan_item",
                    "procurement_method_detail",
                    "construction_type", "created_at", "days_remaining", "is_urgent_warning"]
    search_fields = ["number", "supplier", "notice", "construction_type"]
    list_filter = ("buyer", "is_registered_in_treasury",)


@admin.register(ContractItem)
class ContractItemAdmin(admin.ModelAdmin):
    list_display = ["contract", "year", "plan_share", "contract_amount", "contract_cost", ]
    search_fields = ["contract", ]
    list_filter = ("year",)


@admin.register(ContractQuarterlyFinance)
class ContractQuarterlyFinanceAdmin(admin.ModelAdmin):
    list_display = ["contract", "quarter", "year", "planned_cost", "actual_cost", ]
    search_fields = ["contract", ]
    list_filter = ("year",)


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ["full_name", "short_name", "is_active", "parent__short_name"]
    search_fields = ["short_name", "is_active", "parent__short_name"]
    list_filter = ("is_active", "parent__short_name",)


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ["name", "unp"]
    search_fields = ["name", "unp"]


@admin.register(InternalEconomicClassifier)
class EconomicClassifierAdmin(admin.ModelAdmin):
    list_display = ["code", "name", "parent"]
    search_fields = ["code", "name"]
    list_filter = ('is_active', "code", )


@admin.register(ProgramCode)
class ProgramCodeAdmin(admin.ModelAdmin):
    list_display = ["code_api", "description", "is_active"]
    search_fields = ["code_api", "description"]
    list_filter = ("code_api",)


@admin.register(FunctionalCode)
class FunctionalCodeAdmin(admin.ModelAdmin):
    list_display = ["code_api", "description", "is_active"]
    search_fields = ["code_api", "description"]
    list_filter = ("code_api",)


@admin.register(ExternalEconomicCode)
class ExternalEconomicCodeAdmin(admin.ModelAdmin):
    list_display = ["code_api", "description", "is_active"]
    search_fields = ["code_api", "description"]
    list_filter = ("code_api",)


@admin.register(OkrbProduct)
class OkrbProductAdmin(admin.ModelAdmin):
    list_display = ["code", "title", "is_active"]
    search_fields = ["code", "title"]
    list_filter = ("is_active",)


@admin.register(UnitOfMeasurement)
class UnitOfMeasurementAdmin(admin.ModelAdmin):
    list_display = ["code", "short_name", "is_active"]
    search_fields = ["code", "short_name"]
    list_filter = ("is_active",)


@admin.register(Buyer)
class BuyerAdmin(admin.ModelAdmin):
    list_display = ["shot_name", "full_name", "is_active"]
    search_fields = ["shot_name", "full_name"]
    list_filter = ("is_active",)


@admin.register(ProcurementMethodDetail)
class ProcurementMethodDetailAdmin(admin.ModelAdmin):
    list_display = ["name", "parent", "is_active"]
    search_fields = ["name", ]
    list_filter = ("is_active",)


@admin.register(TreasuryPayment)
class TreasuryPaymentAdmin(admin.ModelAdmin):
    list_display = ['payment_date', 'quarter', "amount", "contract", "notice", "payment_number", "created_at", ]
    search_fields = ["contract", "payment_number", "notice", 'payment_date', "amount"]
    list_filter = ('quarter',)
