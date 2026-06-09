import { type ColumnDef } from "@tanstack/react-table";
import { FileTextIcon, PencilIcon } from "lucide-react";

import { type ProcurementPlanItem } from "@/types/data.types";

export const columns: ColumnDef<ProcurementPlanItem>[] = [
  {
    id: "select2",
    cell: ({ row }) => (
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
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "planPointNumber",
    header: "Номер пункта плана",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("planPointNumber")}</div>
    ),
  },
  {
    accessorKey: "goodsName",
    header: "Наименование однородных товаров (работ, услуг)",
    cell: ({ row }) => (
      <div className="capitalize">{row.getValue("goodsName")}</div>
    ),
  },
  // {
  //   accessorKey: "okrbCode",
  //   header: "Код ОКРБ 007-2012",
  //   cell: ({ row }) => (
  //     <div className="lowercase">{row.getValue("okrbCode")}</div>
  //   ),
  // },
  // {
  //   accessorKey: "okrbSubType",
  //   header:
  //     "Наименование подвида товаров (работ, услуг) в соответствии с ОКРБ 007-2012",
  //   cell: ({ row }) => (
  //     <div className="lowercase">{row.getValue("okrbSubType")}</div>
  //   ),
  // },
  // {
  //   accessorKey: "subject",
  //   header: "Предмет государственной закупки",
  //   cell: ({ row }) => (
  //     <div className="lowercase">{row.getValue("subject")}</div>
  //   ),
  // },
  {
    accessorKey: "volume",
    header: () => <div className="text-right">Ориентировочные объемы</div>,
    cell: ({ row }) => {
      return (
        <div className="text-right font-medium">
          {row.getValue("volume")} единица{" "}
        </div>
      );
    },
  },
  {
    accessorKey: "cost",
    header: () => <div className="text-right">Ориентировочная стоимость</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("cost"));

      const formatted = new Intl.NumberFormat("by-BY", {
        style: "currency",
        currency: "BYN",
      }).format(amount);

      return <div className="text-right font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: "customer",
    header: () => <div className="text-right">Исполнитель</div>,
    cell: ({ row }) => {
      return <div className="capitalize">{row.getValue("customer")}</div>;
    },
  },
  {
    accessorKey: "department",
    header: () => <div className="text-right">Подразделения</div>,
    cell: ({ row }) => {
      return <div className="capitalize">{row.getValue("department")}</div>;
    },
  },
  //   {
  //     accessorKey: "period",
  //     header: "Срок (периодичность) проведения процедуры",
  //     cell: ({ row }) => (
  //       <div className="lowercase">{row.getValue("period")}</div>
  //     ),
  //   },
];
