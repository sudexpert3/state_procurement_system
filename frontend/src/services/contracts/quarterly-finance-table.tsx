import type { EconomicInfo } from "./contract-detail-body";

import { useState } from "react";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
import { DeleteButton } from "@/shared/components/delete-button";
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
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

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
  economicInfoByContractItem,
}: {
  contractId: number;
  /**
   * id ContractItem (строка спецификации) → экономический код и код ЭКР
   * внутренний. ContractQuarterlyFinance хранит только id строки
   * (contract_item), без кодов напрямую — карта строится в
   * `ContractDetailBody`, см. его комментарий.
   */
  economicInfoByContractItem?: Map<number, EconomicInfo>;
}) => {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const query = rqClient.useQuery("get", "/api/contract_quarterly_finance/", {
    params: { query: { contract: contractId } },
  });

  const deleteMutation = rqClient.useMutation(
    "delete",
    "/api/contract_quarterly_finance/{id}/",
  );

  const handleDelete = (id: number) => {
    setDeletingId(id);
    deleteMutation.mutate(
      { params: { path: { id } } },
      {
        onSuccess: () => {
          setDeletingId(null);
          queryClient.invalidateQueries({
            queryKey: ["get", "/api/contract_quarterly_finance/"],
          });
          toast.success("Запись квартального плана удалена");
        },
        onError: (error) => {
          setDeletingId(null);
          handleHttpError(error, "Не удалось удалить запись", true);
        },
      },
    );
  };

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
          <TableHead>Экономический код</TableHead>
          <TableHead>Код ЭКР внутренний</TableHead>
          <TableHead>План (правится вручную)</TableHead>
          <TableHead>Факт (авторасчёт по платежам)</TableHead>
          <TableHead>Остаток</TableHead>
          <TableHead>Действия</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const economicInfo = row.contract_item
            ? economicInfoByContractItem?.get(row.contract_item)
            : undefined;
          return (
            <TableRow key={row.id}>
              <TableCell>{row.year}</TableCell>
              <TableCell>
                {QUARTER_LABELS[row.quarter] ?? row.quarter}
              </TableCell>
              <TableCell>{economicInfo?.economicCode ?? "—"}</TableCell>
              <TableCell>{economicInfo?.internalEkrCode ?? "—"}</TableCell>
              <TableCell>
                <EditablePlannedCostField
                  id={row.id}
                  plannedCost={row.planned_cost ?? "0"}
                />
              </TableCell>
              <TableCell>{formatByn(row.actual_cost)}</TableCell>
              <TableCell>{formatByn(row.remainder_cost)}</TableCell>
              <TableCell>
                <DeleteButton
                  onConfirm={() => handleDelete(row.id)}
                  isPending={deletingId === row.id}
                  description="Запись квартального плана/факта будет удалена из базы безвозвратно."
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
