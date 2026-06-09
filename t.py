from django.db import connection

with connection.cursor() as cursor:
    if connection.vendor == 'postgresql':
        cursor.execute("TRUNCATE TABLE procurement_budgetcosts, procurement_planversion, procurement_plan, procurement_planshare RESTART IDENTITY CASCADE;")
    else:
        cursor.execute("DELETE FROM procurement_budgetcosts;")
        cursor.execute("DELETE FROM procurement_planshare;")
        cursor.execute("DELETE FROM procurement_plan_plan;")
        cursor.execute("DELETE FROM procurement_plan_planversion;")
        cursor.execute("DELETE FROM sqlite_sequence;")
print("Локальная БД полностью стерильна. Конфликты устранены.")
exit()
