import { useState } from "react";

import { useGeneralMoneyReportQuery } from "@/services/reports";
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
import { formatByn } from "@/shared/lib/helpers/format-money";

const COLUMNS: {
  key: keyof import("@/services/reports").GeneralMoneyRow;
  label: string;
}[] = [
  { key: "planned_annual", label: "Плановое назначение на год" },
  {
    key: "prior_years_obligations",
    label: "Принятые обязательства прошлых лет",
  },
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

export const GeneralMoneyTab = () => {
  const [year, setYear] = useState(new Date().getFullYear());

  const { data, isLoading, isError } = useGeneralMoneyReportQuery(year);

  return (
    <div className="flex flex-col gap-4">
      <Input
        type="number"
        value={year}
        onChange={(e) => setYear(Number(e.target.value))}
        className="w-32"
      />

      {isLoading && <Skeleton className="h-48 w-full" />}
      {isError && (
        <p className="text-destructive text-sm">Не удалось загрузить отчёт</p>
      )}

      {data && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Статья ЭКР</TableHead>
                {COLUMNS.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow
                  key={`${row.functional_class_id}-${row.economic_class_id}`}>
                  <TableCell>
                    {row.economic_code} — {row.economic_description}
                  </TableCell>
                  {COLUMNS.map((col) => {
                    const value = row[col.key];
                    const isCalibrationMissing =
                      (col.key === "allocated_limit" ||
                        col.key === "unallocated_limit") &&
                      row.allocated_limit === 0;

                    return (
                      <TableCell
                        key={col.key}
                        className={
                          isCalibrationMissing
                            ? "text-muted-foreground"
                            : undefined
                        }>
                        {isCalibrationMissing
                          ? "калибровка не проведена"
                          : formatByn(value as number)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};
