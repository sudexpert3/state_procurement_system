import type { ColumnDef } from "@tanstack/react-table";
import type { ReactNode } from "react";
import type { CostDepartment } from "@/shared/api/schema";

import { useMemo } from "react";

import { PencilIcon } from "lucide-react";

import { DataTable } from "@/shared/components/data-table/data-table";
import {
  DataTableCell,
  DataTableColumnHeader,
} from "@/shared/components/data-table/data-table-cell";
import { DeleteButton } from "@/shared/components/delete-button";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { TableCell, TableRow } from "@/shared/components/ui/table";
import { formatByn } from "@/shared/lib/helpers/format-money";
import { cn } from "@/shared/lib/utils";

const toNumber = (value: number | string | undefined) => Number(value ?? 0);

const createColumns = (
  onEdit?: (item: CostDepartment) => void,
  onDelete?: (item: CostDepartment) => void,
  deletingId?: number | null,
): ColumnDef<CostDepartment>[] => {
  const columns: ColumnDef<CostDepartment>[] = [
    {
      accessorKey: "department_detail.short_name",
      header: () => (
        <DataTableColumnHeader className="text-left">
          Наименование подразделения
        </DataTableColumnHeader>
      ),
      cell: ({ getValue }) => (
        <DataTableCell className="text-left">
          {getValue<string>()}
        </DataTableCell>
      ),
    },
    {
      accessorKey: "shared_amount",
      header: "Количество",
      cell: ({ getValue }) => {
        const value = toNumber(getValue<number | string>());
        return (
          <DataTableCell>
            {value.toLocaleString("ru-RU", { maximumFractionDigits: 3 })}
          </DataTableCell>
        );
      },
    },
    {
      accessorKey: "total_shared_cost",
      header: "Общая сумма",
      cell: ({ getValue }) => formatByn(getValue<number>()),
    },
    {
      accessorKey: "shared_cost",
      header: "Сумма со счетов казначейства",
      cell: ({ getValue }) => formatByn(getValue<string>()),
    },
    {
      accessorKey: "shared_inner_cost",
      header: "Собственные средства",
      cell: ({ getValue }) => (
        <DataTableCell>{formatByn(getValue<string>())}</DataTableCell>
      ),
    },
    {
      accessorKey: "shared_fund_cost",
      header: "Оплата со счетов заказчика",
      cell: ({ getValue }) => formatByn(getValue<string>()),
    },
  ];

  if (!onEdit && !onDelete) return columns;

  return [
    {
      id: "actions",
      size: 50,
      cell: ({ row }) => (
        <DataTableCell>
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(row.original)}>
              <PencilIcon size={16} className="text-muted-foreground" />
            </Button>
          )}
          {onDelete && (
            <DeleteButton
              onConfirm={() => onDelete(row.original)}
              isPending={deletingId === row.original.id}
              description="Распределение финансирования для этого подразделения будет удалено безвозвратно."
            />
          )}
        </DataTableCell>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    ...columns,
  ];
};

export const DepartmentsTable = ({
  title,
  data,
  actions,
  className,
  onEdit,
  onDelete,
  deletingId,
}: {
  title: string;
  data: CostDepartment[];
  actions?: ReactNode;
  className?: string;
  onEdit?: (item: CostDepartment) => void;
  onDelete?: (item: CostDepartment) => void;
  deletingId?: number | null;
}) => {
  const columns = useMemo(
    () => createColumns(onEdit, onDelete, deletingId),
    [onEdit, onDelete, deletingId],
  );
  const actionsColumnSpan = onEdit || onDelete ? 1 : 0;

  return (
    <Card className={cn("col-span-full mt-2 gap-2 p-3 ring-0", className)}>
      <CardHeader className="px-0">
        <CardTitle className="text-base font-semibold tracking-wide uppercase">
          {title}
        </CardTitle>
        <CardAction>{actions}</CardAction>
      </CardHeader>
      <CardContent className="p-0">
        <DataTable
          data={data}
          columns={columns}
          pagination={false}
          cellClassName="text-center"
          footer={
            data.length > 1
              ? () => (
                  <TableRow>
                    {actionsColumnSpan > 0 && <TableCell />}
                    <TableCell className="text-left font-semibold">
                      ИТОГО
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {data
                        .reduce(
                          (sum, item) => sum + toNumber(item.shared_amount),
                          0,
                        )
                        .toLocaleString("ru-RU", {
                          maximumFractionDigits: 3,
                        })}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {formatByn(
                        data.reduce(
                          (sum, item) => sum + item.total_shared_cost,
                          0,
                        ),
                      )}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {formatByn(
                        data.reduce(
                          (sum, item) => sum + toNumber(item.shared_cost),
                          0,
                        ),
                      )}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {formatByn(
                        data.reduce(
                          (sum, item) => sum + toNumber(item.shared_inner_cost),
                          0,
                        ),
                      )}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {formatByn(
                        data.reduce(
                          (sum, item) => sum + toNumber(item.shared_fund_cost),
                          0,
                        ),
                      )}
                    </TableCell>
                  </TableRow>
                )
              : undefined
          }
        />
      </CardContent>
    </Card>
  );
};
