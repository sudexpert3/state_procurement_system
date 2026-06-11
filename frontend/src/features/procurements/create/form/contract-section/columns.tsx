import type { ColumnDef } from "@tanstack/react-table";

import { FileTextIcon, PencilIcon } from "lucide-react";

type Buyer = {
  id: number;
  fullName: string;
  shortName: string;
  isActive: boolean;
};

export type ProcurementContract = {
  id: number;
  number: string;
  total_cost: number;
  supplier_id: number;
  construction_type: string;
  contract_date: string | null; //! или Date
  //   created_at: string | null;
  fixed_assets_plan_item: string;
  is_registered_in_treasury: boolean;
  notice: string;
  parent_contract_id: number | null;
  payment_terms: string;
  planned_delivery_date: string | null; //! или Date
  procurement_method_detail_id: number;
  buyerId: number;
  buyerDetail: Buyer;
};

type ContractWithoutId = Omit<ProcurementContract, "id">;

export const columns: ColumnDef<ProcurementContract>[] = [
  {
    id: "select2",
    cell: ({ row }) => {
      return (
        <div className="flex gap-2">
          <FileTextIcon
            size={18}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          />

          <PencilIcon
            size={18}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
          />
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
    accessorKey: "number",
    header: "№ договора",
  },
  {
    accessorKey: "total_cost",
    header: "Сумма договора",
    cell: ({ row }) => {
      const value = row.getValue("total_cost") as number;
      return value.toLocaleString("ru-RU");
    },
  },
  {
    accessorKey: "supplier_id",
    header: "Поставщик",
  },
  {
    accessorKey: "construction_type",
    header: "Вид строительства",
  },
  {
    accessorKey: "contract_date",
    header: "Дата договора",
    cell: ({ row }) => row.getValue("contract_date") || "—",
  },
  {
    accessorKey: "fixed_assets_plan_item",
    header: "Пункт плана ОС",
  },
  {
    accessorKey: "is_registered_in_treasury",
    header: "Зарегистрирован в казначействе",
    cell: ({ row }) =>
      row.getValue("is_registered_in_treasury") ? "Да" : "Нет",
  },
  {
    accessorKey: "notice",
    header: "Примечание",
  },
  {
    accessorKey: "parent_contract_id",
    header: "Родительский договор",
    cell: ({ row }) => row.getValue("parent_contract_id") ?? "—",
  },
  {
    accessorKey: "payment_terms",
    header: "Условия оплаты",
  },
  {
    accessorKey: "planned_delivery_date",
    header: "Плановая дата поставки",
    cell: ({ row }) => row.getValue("planned_delivery_date") || "—",
  },
  {
    accessorKey: "procurement_method_detail_id",
    header: "Способ закупки",
  },
  {
    accessorKey: "buyerDetail.shortName",
    header: "Покупатель",
  },
];
