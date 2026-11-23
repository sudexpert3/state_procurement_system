import type { ColumnDef } from "@tanstack/react-table";
import type { GeneralMoneyRow } from "@/services/reports";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useGeneralMoneyReportQuery } from "@/services/reports";
import { ColumnVisibilityDropdown } from "@/shared/components/data-table/column-visibility-dropdown";
import { DataTable } from "@/shared/components/data-table/data-table";
import {
  DataTableCell,
  DataTableColumnHeader,
} from "@/shared/components/data-table/data-table-cell";
import { Input } from "@/shared/components/ui/input";
import { TableCell, TableRow } from "@/shared/components/ui/table";
import { formatByn } from "@/shared/lib/helpers/format-money";

type MoneyKey = Exclude<
  keyof GeneralMoneyRow,
  | "functional_class_id"
  | "economic_class_id"
  | "functional_code"
  | "economic_code"
  | "economic_description"
  | "year"
  | "is_calibrated"
>;

const MONEY_COLUMNS: { key: MoneyKey; label: string }[] = [
  { key: "planned_annual", label: "Плановое назначение на год" },
  {
    key: "prior_years_obligations",
    label: "Принятые обязательства прошлых лет",
  },
  { key: "available_limit", label: "Доступные лимиты" },
  { key: "allocated_limit", label: "Доведённые лимиты" },
  { key: "unassigned_limit", label: "Нераспределённые лимиты" },
  { key: "entered_into_plan", label: "Внесено в ГПЗ" },
  { key: "committed_obligations", label: "Принято обязательств" },
  { key: "paid_actual", label: "Фактическая оплата" },
  { key: "unallocated_limit", label: "Остаток незапланированных средств" },
  { key: "remainder_unobligated", label: "Остаток от принятых обязательств" },
  {
    key: "remainder_with_actual",
    label: "Остаток с учётом фактических расходов",
  },
];

// Статья ЭКР в коде — это первые два сегмента ("1 10 10 99" → "1 10", "2 40
// 03 00" → "2 40"), на этом уровне пользователь просил промежуточные суммы.
const getArticleGroupKey = (code: string) => {
  const segments = code.trim().split(/\s+/);
  return segments.slice(0, 2).join(" ") || code;
};

// API отдаёт строки без гарантированного порядка (DISTINCT без ORDER BY на
// бэкенде) — сортируем сами, по числовым сегментам кода, а не лексикографически
// (иначе "1 10 10 99" оказался бы раньше "1 10 3 99").
const compareEconomicCode = (a: string, b: string) => {
  const pa = a.trim().split(/\s+/).map(Number);
  const pb = b.trim().split(/\s+/).map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};

// DRF по умолчанию сериализует Decimal строкой — поля типизированы как number,
// но рантайм-значение может оказаться строкой, поэтому везде явный Number().
const sumBy = (rows: GeneralMoneyRow[], key: MoneyKey) =>
  rows.reduce((sum, row) => sum + Number(row[key]), 0);

type Row =
  | { kind: "data"; id: string; row: GeneralMoneyRow }
  | {
      kind: "subtotal";
      id: string;
      groupKey: string;
      sums: Record<MoneyKey, number>;
    };

const buildRows = (data: GeneralMoneyRow[]): Row[] => {
  const sorted = [...data].sort((a, b) =>
    compareEconomicCode(a.economic_code, b.economic_code),
  );

  const result: Row[] = [];
  let group: GeneralMoneyRow[] = [];
  let groupKey: string | null = null;

  const flush = () => {
    // Промежуточный итог имеет смысл только когда в статье больше одной
    // строки (строки внутри статьи бывают, например, из-за нескольких
    // подразделений) — иначе это просто дублирование единственной строки.
    if (groupKey && group.length > 1) {
      const sums = Object.fromEntries(
        MONEY_COLUMNS.map((col) => [col.key, sumBy(group, col.key)]),
      ) as Record<MoneyKey, number>;
      result.push({
        kind: "subtotal",
        id: `subtotal-${groupKey}`,
        groupKey,
        sums,
      });
    }
    group = [];
  };

  sorted.forEach((row, index) => {
    const key = getArticleGroupKey(row.economic_code);
    if (key !== groupKey) {
      flush();
      groupKey = key;
    }
    group.push(row);
    result.push({ kind: "data", id: `row-${index}`, row });
  });
  flush();

  return result;
};

const createColumns = (): ColumnDef<Row, unknown>[] => [
  {
    id: "article",
    // Фикс. ширина — иначе перенос описания в 2-ю строку (ниже) не сработает:
    // без ограничения ширины браузер просто растянет колонку под всю строку.
    size: 260,
    header: () => (
      <DataTableColumnHeader className="text-left">
        Статья ЭКР
      </DataTableColumnHeader>
    ),
    enableHiding: false,
    enableSorting: false,
    cell: ({ row }) => {
      const data = row.original;
      if (data.kind === "subtotal") {
        return (
          <DataTableCell className="text-left font-semibold">
            Итого по статье {data.groupKey}
          </DataTableCell>
        );
      }
      return (
        // Код отдельной строкой сверху (компактно, для быстрого поиска
        // глазами), описание под ним и параграф последней строкой помельче —
        // одна и та же экономическая статья может встречаться под разными
        // параграфами (пример пользователя — "2.40.01.00" сразу под двумя
        // разными параграфами), без этого было непонятно, какая строка к
        // какому параграфу относится, см. CurrentStatus.md. Отдельного
        // столбца под параграф не заводим — вся информация о статье должна
        // быть в одном месте.
        <DataTableCell className="text-left whitespace-normal">
          <div className="font-medium whitespace-nowrap">
            {data.row.economic_code}
          </div>
          <div className="text-muted-foreground text-xs">
            {data.row.economic_description}
          </div>
          <div className="text-muted-foreground text-xs">
            Параграф: {data.row.functional_code} —{" "}
            {data.row.functional_description}
          </div>
        </DataTableCell>
      );
    },
  },
  ...MONEY_COLUMNS.map(
    (col): ColumnDef<Row, unknown> => ({
      id: col.key,
      header: () => <DataTableColumnHeader>{col.label}</DataTableColumnHeader>,
      meta: { label: col.label },
      enableSorting: false,
      cell: ({ row }) => {
        const data = row.original;

        if (data.kind === "subtotal") {
          return <DataTableCell>{formatByn(data.sums[col.key])}</DataTableCell>;
        }

        const isCalibrationMissing =
          (col.key === "allocated_limit" || col.key === "unallocated_limit") &&
          !data.row.is_calibrated;

        return (
          <DataTableCell
            className={
              isCalibrationMissing ? "text-muted-foreground" : undefined
            }>
            {isCalibrationMissing
              ? "калибровка не проведена"
              : formatByn(Number(data.row[col.key]))}
          </DataTableCell>
        );
      },
    }),
  ),
];

export const GeneralMoneyTab = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [columnsSlot, setColumnsSlot] = useState<HTMLDivElement | null>(null);

  const { data, isLoading, isError } = useGeneralMoneyReportQuery(year);

  const columns = useMemo(() => createColumns(), []);
  const rows = useMemo(() => (data ? buildRows(data) : []), [data]);

  const grandTotals = useMemo(
    () =>
      data &&
      (Object.fromEntries(
        MONEY_COLUMNS.map((col) => [col.key, sumBy(data, col.key)]),
      ) as Record<MoneyKey, number> | undefined),
    [data],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-32 bg-white"
        />
        <div ref={setColumnsSlot} className="flex w-72 justify-end" />
      </div>

      {isError && (
        <p className="text-destructive text-sm">Не удалось загрузить отчёт</p>
      )}

      <DataTable
        data={rows}
        columns={columns}
        isLoading={isLoading}
        cellClassName="text-center"
        // Длинные заголовки колонок переносятся в 2-4 строки — ширину
        // колонки диктуют (более короткие) суммы в ячейках, не заголовок.
        headerClassName="text-center whitespace-normal align-bottom"
        pagination={false}
        fillAvailableHeight
        persistenceKey="reports-general-money"
        getRowClassName={(row) =>
          row.kind === "subtotal" ? "bg-muted/60 font-semibold" : undefined
        }
        actions={(table) =>
          columnsSlot &&
          createPortal(
            <ColumnVisibilityDropdown table={table} className="max-w-72" />,
            columnsSlot,
          )
        }
        footer={
          grandTotals
            ? () => (
                <TableRow>
                  <TableCell className="text-left font-semibold">
                    ИТОГО по всем статьям
                  </TableCell>
                  {MONEY_COLUMNS.map((col) => (
                    <TableCell
                      key={col.key}
                      className="text-center font-semibold">
                      {formatByn(grandTotals[col.key])}
                    </TableCell>
                  ))}
                </TableRow>
              )
            : undefined
        }
      />
    </div>
  );
};
