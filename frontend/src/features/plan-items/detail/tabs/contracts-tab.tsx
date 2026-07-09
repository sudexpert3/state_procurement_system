import type { ColumnDef } from "@tanstack/react-table";
import type { ContractDetail, PlanItemDetail } from "../procurement.mock";

import { useMemo, useState } from "react";

import { DepartmentsTable } from "@/features/plan-items/detail/components/departments-table";
import { DataTable } from "@/shared/components/data-table/data-table";
import { CardContent } from "@/shared/components/ui/card";
import { formatDate } from "@/shared/lib/helpers/format-date";
import { formatByn, formatMoney } from "@/shared/lib/helpers/format-money";
import { cn } from "@/shared/lib/utils";

import { DetailField } from "../components/detail-field";
import { SectionCard } from "../components/section-card";
import { StatCard } from "../components/stat-card";

const columns: ColumnDef<ContractDetail, unknown>[] = [
  {
    accessorKey: "contractNumber",
    header: "№ договора",
  },
  {
    accessorKey: "contractDate",
    header: "Дата договора",
    cell: ({ getValue }) => formatDate(getValue<Date>()),
  },
  {
    id: "supplierName",
    header: "Поставщик",
    accessorFn: (row) => row.supplier.name,
  },
  {
    id: "supplierUnp",
    header: "УНП поставщика",
    accessorFn: (row) => row.supplier.unp,
  },
  {
    accessorKey: "contractSum",
    header: "Сумма договора",
    cell: ({ getValue }) => formatByn(getValue<number>()),
  },
  {
    id: "departments",
    header: "Подразделение",
    accessorFn: (row) =>
      row.departments
        .map((d) => d.shortName)
        .filter(Boolean)
        .join(", "),
  },
];

// Таб «Договоры» — аналитика по пункту плана + список договоров с позициями.
export const ContractsTab = ({ plan }: { plan: PlanItemDetail }) => {
  // Сумма всех договоров по пункту плана.
  // TODO: заменить на значение с бэкенда, когда эндпоинт отдаст агрегат.
  const contractsTotal = useMemo(
    () => plan.contracts.reduce((sum, c) => sum + c.contractSum, 0),
    [plan],
  );
  const balance = plan.allCost - contractsTotal;

  // Выбранный договор: по умолчанию — последний добавленный, по клику в таблице — выбранный.
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selectedContract =
    plan.contracts.find((c) => c.id === selectedId) ?? plan.contracts.at(-1);

  return (
    <SectionCard title="Договоры">
      <CardContent className="space-y-4 px-2">
        {/* Аналитика по договорам пункта плана */}
        <div className="flex flex-col gap-4 md:flex-row">
          <StatCard
            title="Общая сумма позиции"
            value={formatMoney(plan.allCost)}
          />
          <StatCard
            title="Сумма всех договоров"
            value={formatMoney(contractsTotal)}
          />
          <StatCard
            title="Остаток денег по пункту"
            value={formatMoney(balance)}
            valueClassName={cn(balance < 0 && "text-destructive")}
          />
        </div>

        {/* Список договоров пункта плана */}
        <DataTable
          data={plan.contracts}
          columns={columns}
          pagination={false}
          getRow={(contract) => setSelectedId(contract.id)}
        />

        {/* Сведения о выбранном договоре (по умолчанию — последний добавленный) */}
        {!selectedContract ? (
          <p className="text-muted-foreground text-sm">
            По этому плану договоров нет.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 rounded-md border p-3 md:grid-cols-3">
            <DetailField
              label="№ договора"
              value={selectedContract.contractNumber}
            />
            <DetailField
              label="Дата договора"
              value={formatDate(selectedContract.contractDate)}
            />
            <DetailField
              label="Поставщик"
              value={selectedContract.supplier.name}
            />
            <DetailField
              label="УНП поставщика"
              value={selectedContract.supplier.unp}
            />
            <DetailField
              label="Сумма договора, BYN"
              value={formatByn(selectedContract.contractSum)}
            />

            <DepartmentsTable
              title="Позиция договора"
              data={selectedContract.departments}
            />
          </div>
        )}
      </CardContent>
    </SectionCard>
  );
};
