import { useState } from "react";

import { UploadIcon } from "lucide-react";

import { useChangeRequestsQuery } from "@/services/change-requests";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { formatDate } from "@/shared/lib/helpers/format-date";

import { BudgetLimitCorrectionImport } from "./budget-limit-correction-import";
import { GeneralMoneyTab } from "./general-money-tab";

// Справочная дата последнего файла fin_xxxx (запрос пользователя 2026-11-20,
// уточнён 2026-11-20: одной строкой сразу после описания карточки, без
// отдельного блока текста ниже). У заявки kind=BUDGET_LIMIT_CORRECTION
// загрузка/разбор/принятие происходят в ОДНОЙ транзакции (см. backend/
// procurement/services/change_requests.py::create_budget_limit_correction —
// "заявка создаётся, тут же отправляется на проверку и сразу одобряется"),
// отдельной даты "загрузки" бэкенд не хранит — поэтому одна дата, не три.
const LastBudgetLimitCorrectionNote = () => {
  const { data, isLoading } = useChangeRequestsQuery({
    kind: "BUDGET_LIMIT_CORRECTION",
    limit: 1,
    offset: 0,
  });
  const last = data?.results[0];

  if (isLoading) return null;

  if (!last) {
    return <span>(fin_xxxx ещё не загружался)</span>;
  }

  return (
    <span>(загружен: {formatDate(last.reviewed_at ?? last.created_at)})</span>
  );
};

const GeneralMoneyPage = () => {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <Card className="max-w-full flex-1 gap-2 bg-transparent ring-0">
      <CardHeader>
        <CardTitle>Общие деньги</CardTitle>
        <CardDescription>
          Финансовая аналитика по статьям: план, лимиты, обязательства, оплата{" "}
          <LastBudgetLimitCorrectionNote />
        </CardDescription>
        <CardAction>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <UploadIcon size={16} />
            Импорт из файла
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <GeneralMoneyTab />
      </CardContent>

      <BudgetLimitCorrectionImport
        open={importOpen}
        onClose={() => setImportOpen(false)}
      />
    </Card>
  );
};

export const Component = GeneralMoneyPage;
