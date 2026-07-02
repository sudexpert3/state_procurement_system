import type { ColumnDef } from "@tanstack/react-table";
import type { AnnualPlan, PlanStatus } from "./plans.mock";

import { Badge } from "@/shared/components/ui/badge";

// Форматирование даты и времени для колонок ГИАС / последнего изменения
const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "short",
  timeStyle: "short",
});

const formatDateTime = (value: string) =>
  dateTimeFormatter.format(new Date(value));

// Соответствие статуса плана варианту Badge
const statusVariant: Record<
  PlanStatus,
  "default" | "secondary" | "destructive"
> = {
  Опубликован: "default",
  "В архиве": "secondary",
  "Не актуален": "destructive",
};

export const columns: ColumnDef<AnnualPlan>[] = [
  {
    accessorKey: "giasRepostedAt",
    header: "Дата и время переразмещения в ГИАС",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatDateTime(row.getValue("giasRepostedAt"))}
      </span>
    ),
  },
  {
    accessorKey: "version",
    header: "Версия плана",
  },
  {
    accessorKey: "gzbId",
    header: "Идентификационный номер годового плана ГЗБ",
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue("gzbId")}</span>
    ),
  },
  {
    accessorKey: "name",
    header: "Наименование",
  },
  {
    accessorKey: "updatedAt",
    header: "Дата и время последнего изменения",
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {formatDateTime(row.getValue("updatedAt"))}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Статус",
    cell: ({ row }) => {
      const status = row.getValue<PlanStatus>("status");
      return <Badge variant={statusVariant[status]}>{status}</Badge>;
    },
  },
  {
    accessorKey: "unp",
    header: "УНП",
  },
];
