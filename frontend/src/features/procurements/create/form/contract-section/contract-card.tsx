import type { ContractItem } from "./contract.schema";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";

import { contractStatus } from "./config";
import {
  calcRemainingBalance,
  calcTotalLiabilities,
  calcVariance,
} from "./helpers";

const STATUS_LABELS: Record<string, string> = {
  [contractStatus.ACCEPTED]: "Принято к оплате ТК",
  [contractStatus.CANCELLED]: "Не принято к оплате ТК",
  [contractStatus.DEFAULT]: "—",
};

const formatMoney = (value: number) => value.toLocaleString("ru-RU");
const formatDate = (date: Date | null) =>
  date ? date.toLocaleDateString("ru-RU") : "—";

// Строка «подпись — значение» внутри карточки
const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between gap-4 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-foreground text-right font-medium">{value}</span>
  </div>
);

type Props = {
  contract: ContractItem | null;
  // Сумма плана уровня закупки — нужна для производных значений
  currentPlanBalance: number;
};

// Read-only превью одного выбранного договора. Редактирование — в drawer.
export const ContractCard = ({ contract, currentPlanBalance }: Props) => {
  if (!contract) {
    return (
      <Card className="w-full ring-0">
        <CardContent className="text-muted-foreground px-2 py-8 text-center text-sm">
          Выберите договор в таблице, чтобы увидеть детали
        </CardContent>
      </Card>
    );
  }

  const totalLiabilities = calcTotalLiabilities(contract, currentPlanBalance);
  const variance = calcVariance(contract, currentPlanBalance);
  const remainingBalance = calcRemainingBalance(contract);

  return (
    <div className="flex w-full flex-col gap-4">
      <Card className="w-full ring-0">
        <CardHeader className="px-2">
          <CardTitle className="text-lg font-semibold tracking-wide uppercase">
            Детали договора
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-3 px-2">
          <Row label="№ договора" value={contract.contractNumber || "—"} />
          <Row
            label="Дата договора"
            value={formatDate(contract.contractDate)}
          />
          <Row label="Поставщик" value={contract.supplierId || "—"} />
          <Row
            label="Условия оплаты/поставки"
            value={contract.contractTerms || "—"}
          />
          <Row
            label="Примечания по договору"
            value={contract.contractNotes || "—"}
          />
          <Row
            label="Статус договора"
            value={STATUS_LABELS[contract.contractStatus] ?? "—"}
          />
        </CardContent>
      </Card>

      <Card className="w-full ring-0">
        <CardHeader className="px-2">
          <CardTitle className="text-lg font-semibold tracking-wide uppercase">
            Объёмы финансирования
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-3 px-2">
          <Row
            label="Текущая сумма плана (BYN)"
            value={formatMoney(currentPlanBalance)}
          />
          <Row
            label="Сумма договора (BYN)"
            value={formatMoney(contract.contractSum)}
          />
        </CardContent>
      </Card>

      <Card className="w-full ring-0">
        <CardHeader className="px-2">
          <CardTitle className="text-lg font-semibold tracking-wide uppercase">
            Контроль исполнения
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-3 px-2">
          <Row
            label="Сумма принятых обязательств"
            value={formatMoney(totalLiabilities)}
          />
          <Row
            label="Отклонение (план/договор)"
            value={formatMoney(variance)}
          />
          <Row
            label="Остаток от договора"
            value={formatMoney(remainingBalance)}
          />
        </CardContent>
      </Card>
    </div>
  );
};
