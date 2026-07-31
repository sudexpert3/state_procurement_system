import type { ColumnDef } from "@tanstack/react-table";
import type { ContractItem } from "./contract.schema";

import { FileTextIcon, PencilIcon } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { DeleteButton } from "@/shared/components/ui/delete-button";
import { formatDate } from "@/shared/lib/helpers/format-date";

export const createColumns = (
  onView: (row: ContractItem) => void,
  onEdit: (row: ContractItem) => void,
  onDelete: (id: number) => void,
): ColumnDef<ContractItem>[] => {
  return [
    {
      id: "actions",
      cell: ({ row }) => {
        return (
          <div>
            <Button
              variant="ghost"
              type="button"
              size="icon"
              onClick={() => onView(row.original)}>
              <FileTextIcon
                size={16}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              />
            </Button>
            <Button
              variant="ghost"
              type="button"
              size="icon"
              onClick={() => onEdit(row.original)}>
              <PencilIcon
                size={16}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              />
            </Button>
            <DeleteButton onConfirm={() => onDelete(row.original.id)} />
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "id",
      header: "ID",
    },
    {
      accessorKey: "contractNumber",
      header: "№ договора",
    },
    {
      accessorKey: "contractSum",
      header: "Сумма договора",
      cell: ({ row }) => row.original.contractSum.toLocaleString("ru-RU"),
    },
    {
      accessorKey: "supplierId",
      header: "Поставщик",
    },
    {
      accessorKey: "constructionType",
      header: "Вид строительства",
    },
    {
      accessorKey: "contractDate",
      header: "Дата договора",
      cell: ({ row }) => formatDate(row.original.contractDate),
    },
    {
      accessorKey: "fixedAssetsPlanItem",
      header: "Пункт плана ОС",
    },
    {
      accessorKey: "isRegisteredInTreasury",
      header: "Зарегистрирован в казначействе",
      cell: ({ row }) => (row.original.isRegisteredInTreasury ? "Да" : "Нет"),
    },
    {
      accessorKey: "contractNotes",
      header: "Примечание",
      cell: ({ row }) => row.original.contractNotes || "—",
    },
    {
      accessorKey: "parentContractId",
      header: "Родительский договор",
      cell: ({ row }) => row.original.parentContractId ?? "—",
    },
    {
      accessorKey: "contractTerms",
      header: "Условия оплаты",
    },
    {
      accessorKey: "plannedDeliveryDate",
      header: "Плановая дата поставки",
      cell: ({ row }) => formatDate(row.original.plannedDeliveryDate),
    },
    {
      accessorKey: "procurementMethodDetailId",
      header: "Способ закупки",
    },
    {
      accessorKey: "buyer.shortName",
      header: "Покупатель",
    },
  ];
};
