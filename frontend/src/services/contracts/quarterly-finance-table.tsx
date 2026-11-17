import { rqClient } from "@/shared/api/instance";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatByn } from "@/shared/lib/helpers/format-money";

import { EditablePlannedCostField } from "./editable-planned-cost-field";

const QUARTER_LABELS: Record<string, string> = {
  Q1: "I квартал",
  Q2: "II квартал",
  Q3: "III квартал",
  Q4: "IV квартал",
};

/**
 * Квартальный план/факт договора (Этап 4.3) — переиспользуется и в Drawer'е
 * реестра договоров (`features/contracts`), и на карточке позиции плана
 * (таб «Договоры»/«Платежи», см. CurrentStatus.md).
 */
export const QuarterlyFinanceTable = ({
  contractId,
}: {
  contractId: number;
}) => {
  const query = rqClient.useQuery("get", "/api/contract_quarterly_finance/", {
    params: { query: { contract: contractId } },
  });

  if (query.isLoading) return <Skeleton className="h-24 w-full" />;

  const rows = query.data?.results ?? [];
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-base">
        Квартальный план/факт по договору не ведётся
      </p>
    );
  }

  return (
    <Table className="text-base">
      <TableHeader>
        <TableRow>
          <TableHead>Год</TableHead>
          <TableHead>Квартал</TableHead>
          <TableHead>План (правится вручную)</TableHead>
          <TableHead>Факт (авторасчёт по платежам)</TableHead>
          <TableHead>Остаток</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.year}</TableCell>
            <TableCell>{QUARTER_LABELS[row.quarter] ?? row.quarter}</TableCell>
            <TableCell>
              <EditablePlannedCostField
                id={row.id}
                plannedCost={row.planned_cost ?? "0"}
              />
            </TableCell>
            <TableCell>{formatByn(row.actual_cost)}</TableCell>
            <TableCell>{formatByn(row.remainder_cost)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};
