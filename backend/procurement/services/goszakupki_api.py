import string

import requests
from django.utils import timezone
from procurement.models import Plan, PlanVersion


class GosZakupkiAPIService:
    """Сервис интеграции с ИС 'Тендеры' (goszakupki.by) под регламенты Минфина РБ"""

    BASE_URL = "https://goszakupki.by"

    def __init__(self):
        # Маскируем запросы под ведомственный браузер и передаем TLS-заголовки
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ГКСЭ ERP',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        }
        # В реальной среде здесь подключается сертификат учреждения:
        # self.cert = (settings.GOV_CERT_PATH, settings.GOV_KEY_PATH)

    def send_draft_changes(self, plan_ids: list) -> dict:
        """
        Пакетная отправка подготовленных изменений.
        Формирует проект изменений на goszakupki.by.
        """
        active_versions = PlanVersion.objects.filter(
            plan_id__in=plan_ids,
            is_active=True
        ).select_related('plan', 'okrb_product', 'val_unit')

        payload_items = []

        for version in active_versions:
            # Аппаратное ведомственное ограничение проекта:
            if not version.plan.is_public:
                continue

            payload_items.append({
                "plan_goszakupki_id": version.plan_goszakupki_id,  # Null для новых позиций
                "purchases_id": version.purchases_id,
                "subject": version.title,
                "okrb_code": version.okrb,
                "amount": float(version.val_amount),
                "unit_code": version.val_unit.code if version.val_unit else "",
                "budget_cost": float(version.fund_cost),
                "own_cost": float(version.inner_cost),
                "currency": version.val_currency,
                "months": version.procedure_months
            })

        if not payload_items:
            return {"status": "empty", "message": "Нет публичных позиций для отправки."}

        try:
            # Отправляем черновик проекта в личный кабинет закупщика ГКСЭ
            url = f"{self.BASE_URL}/v1/procurement/plans/drafts"
            # Из-за временного режима AllowAny логируем отправку для отладки
            response = requests.post(url, json={"items": payload_items}, headers=self.headers, timeout=15)

            if response.status_code == 201:
                # Меняем статус позиций плана в нашей СУБД на 'На проверке/портале'
                Plan.objects.filter(id__in=plan_ids).update(status='ON_REVIEW', updated_at=timezone.now())
                return {"status": "success", "project_id": response.json().get("project_id")}
            return {"status": "error", "message": response.text}

        except requests.exceptions.RequestException as e:
            return {"status": "connection_reset", "message": f"Ошибка связи с ИС 'Тендеры' (10054): {str(e)}"}

    def pull_actual_published_plans(self, unp_organization: string) -> dict:
        """
        Кнопка 'Синхронизировать опубликованное'.
        Забирает с сайта финальные данные плана и обновляет СУБД PostgreSQL.
        """
        try:
            url = f"{self.BASE_URL}/v1/procurement/plans/published?unp={unp_organization}"
            response = requests.get(url, headers=self.headers, timeout=15)

            if response.status_code != 200:
                return {"status": "error", "message": "Портал закупок временно недоступен."}

            published_items = response.json().get("results", [])
            updated_count = 0

            for item in published_items:
                # Находим наш локальный мастер-план по регистрационному номеру
                reg_num = item.get("num")
                plan_master = Plan.objects.filter(num=reg_num).first()

                if plan_master:
                    # Переводим в статус 'Опубликован'
                    plan_master.status = 'PUBLISHED'
                    plan_master.save()

                    # Записываем официальные ID, присвоенные порталом госзакупок
                    PlanVersion.objects.filter(plan=plan_master, is_active=True).update(
                        plan_goszakupki_id=item.get("id"),
                        purchases_id=item.get("purchases_id")
                    )
                    updated_count += 1

            return {"status": "success", "updated_records": updated_count}
        except requests.exceptions.RequestException:
            return {"status": "error", "message": "Сетевой сброс соединения удаленным шлюзом (10054)."}
