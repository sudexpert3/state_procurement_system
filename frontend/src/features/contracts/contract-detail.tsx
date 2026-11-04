import type { Contract } from "@/shared/api/schema";

import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
import { Button } from "@/shared/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { Input } from "@/shared/components/ui/input";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatDate } from "@/shared/lib/helpers/format-date";
import { formatByn } from "@/shared/lib/helpers/format-money";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

const QUARTER_LABELS: Record<string, string> = {
  Q1: "I квартал",
  Q2: "II квартал",
  Q3: "III квартал",
  Q4: "IV квартал",
};

const QuarterlyFinanceTable = ({ contractId }: { contractId: number }) => {
  const query = rqClient.useQuery("get", "/api/contract_quarterly_finance/", {
    params: { query: { contract: contractId } },
  });
  const mutation = rqClient.useMutation(
    "patch",
    "/api/contract_quarterly_finance/{id}/",
  );

  const handleBlur =
    (id: number, currentPlannedCost: string) =>
    (event: React.FocusEvent<HTMLInputElement>) => {
      const next = event.target.value;
      if (next === currentPlannedCost) return;

      mutation.mutate(
        { params: { path: { id } }, body: { planned_cost: next } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({
              queryKey: ["get", "/api/contract_quarterly_finance/"],
            });
            toast.success("Плановая сумма сохранена");
          },
          onError: (error) =>
            handleHttpError(error, "Не удалось сохранить сумму", true),
        },
      );
    };

  if (query.isLoading) return <Skeleton className="h-24 w-full" />;

  const rows = query.data?.results ?? [];
  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Квартальный план/факт по договору не ведётся
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Год</TableHead>
          <TableHead>Квартал</TableHead>
          <TableHead>План (правится вручную)</TableHead>
          <TableHead>Факт (авторасчёт по платежам)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell>{row.year}</TableCell>
            <TableCell>{QUARTER_LABELS[row.quarter] ?? row.quarter}</TableCell>
            <TableCell>
              <Input
                type="number"
                step="0.01"
                min={0}
                defaultValue={row.planned_cost ?? "0"}
                onBlur={handleBlur(row.id, row.planned_cost ?? "0")}
                disabled={mutation.isPending}
                className="max-w-40"
              />
            </TableCell>
            <TableCell>{formatByn(row.actual_cost)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

type Props = {
  item: Contract | null;
  onClose: () => void;
};

export const ContractDetail = ({ item, onClose }: Props) => (
  <Drawer
    open={item !== null}
    onOpenChange={(v) => !v && onClose()}
    direction="right">
    <DrawerContent className="flex flex-col sm:max-w-2xl">
      <DrawerHeader>
        <DrawerTitle>Договор № {item?.number}</DrawerTitle>
      </DrawerHeader>

      {item && (
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
          <div className="flex flex-wrap gap-4 text-sm">
            <span>Контрагент: {item.supplier_detail.name}</span>
            <span>Дата заключения: {formatDate(item.contract_date)}</span>
            <span>Сумма: {formatByn(item.total_cost)}</span>
            {item.payment_terms && (
              <span>Условия оплаты: {item.payment_terms}</span>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">
              Спецификация (списание лимитов подразделений)
            </p>
            {item.items.length === 0 ? (
              <p className="text-muted-foreground text-sm">Нет строк</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Наименование</TableHead>
                    <TableHead>Год</TableHead>
                    <TableHead>Количество</TableHead>
                    <TableHead>Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.items.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{line.title ?? "—"}</TableCell>
                      <TableCell>{line.year}</TableCell>
                      <TableCell>{line.contract_amount}</TableCell>
                      <TableCell>{formatByn(line.contract_cost)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Квартальный план/факт</p>
            <QuarterlyFinanceTable contractId={item.id} />
          </div>
        </div>
      )}

      <DrawerFooter>
        <DrawerClose asChild>
          <Button variant="outline" onClick={onClose}>
            Закрыть
          </Button>
        </DrawerClose>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
);
