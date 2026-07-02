import type { ColumnDef } from "@tanstack/react-table";
import type { ContractDetail, ProcurementDetail } from "../procurement.mock";

import { useMemo } from "react";

import { DataTable } from "@/shared/components/data-table/data-table";
import { CardContent } from "@/shared/components/ui/card";
import { formatDate } from "@/shared/lib/helpers/format-date";
import { formatByn, formatMoney } from "@/shared/lib/helpers/format-money";
import { cn } from "@/shared/lib/utils";

import { DepartmentsTable } from "../departments-table";
import { DetailField } from "../detail-field";
import { SectionCard } from "../section-card";
import { StatCard } from "../stat-card";

// Колонки таблицы договоров пункта плана.
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
export const ContractsTab = ({ plan }: { plan: ProcurementDetail }) => {
  // Сумма всех договоров по пункту плана.
  // TODO: заменить на значение с бэкенда, когда эндпоинт отдаст агрегат.
  const contractsTotal = useMemo(
    () => plan.contracts.reduce((sum, c) => sum + c.contractSum, 0),
    [plan],
  );
  const balance = plan.allCost - contractsTotal;

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
        <DataTable data={plan.contracts} columns={columns} pagination={false} />
        {/* По одному блоку на договор (как таб «Информация») */}
        {plan.contracts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            По этому плану договоров нет.
          </p>
        ) : (
          plan.contracts.map((contract) => (
            <div
              key={contract.id}
              className="grid grid-cols-2 gap-4 rounded-md border p-3 md:grid-cols-3">
              <DetailField label="№ договора" value={contract.contractNumber} />
              <DetailField
                label="Дата договора"
                value={formatDate(contract.contractDate)}
              />
              <DetailField label="Поставщик" value={contract.supplier.name} />
              <DetailField
                label="УНП поставщика"
                value={contract.supplier.unp}
              />
              <DetailField
                label="Сумма договора, BYN"
                value={formatByn(contract.contractSum)}
              />

              <DepartmentsTable
                title="Позиция договора"
                data={contract.departments}
              />
            </div>
          ))
        )}
      </CardContent>
    </SectionCard>
  );
};
