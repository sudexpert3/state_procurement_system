import { Plus, Trash2 } from "lucide-react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/kit/button";
import { Input } from "@/shared/ui/kit/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/kit/table";

import {
  calcColTotal,
  calcRowTotal,
  calcYearTotal,
  formatAmount,
} from "./helpers";
import { type QuarterRow, type YearDistribution } from "./quarter.schema";

const QUARTERS: { key: keyof QuarterRow; label: string }[] = [
  { key: "q1", label: "I кв." },
  { key: "q2", label: "II кв." },
  { key: "q3", label: "III кв." },
  { key: "q4", label: "IV кв." },
];

const ROW_CONFIGS = [
  {
    key: "financing" as const,
    label: "Финансирование",
    description: "оплачено",
    colorClass: "text-blue-600",
    dotClass: "bg-blue-500",
  },
  {
    key: "plan" as const,
    label: "Подлежит к оплате",
    description: "план",
    colorClass: "text-green-700",
    dotClass: "bg-green-600",
  },
  {
    key: "transfer" as const,
    label: "Перенос на след. год",
    description: "",
    colorClass: "text-amber-700",
    dotClass: "bg-amber-500",
  },
];

function AmountInput({ name, disabled }: { name: string; disabled?: boolean }) {
  const { register } = useFormContext();

  return (
    <Input
      type="number"
      min={0}
      placeholder="-"
      disabled={disabled}
      className="focus-visible:ring-ring h-8 w-full border-0 bg-transparent px-2 text-right text-sm focus-visible:ring-1"
      {...register(name, {
        valueAsNumber: true,
        min: 0,
      })}
    />
  );
}

function TotalCell({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <TableCell
      className={cn(
        "pr-3 text-right text-sm font-medium tabular-nums",
        value === 0 && "text-muted-foreground",
        className,
      )}>
      {formatAmount(value)}
    </TableCell>
  );
}

function YearTable({ yearIndex }: { yearIndex: number }) {
  const yearData: YearDistribution = useWatch({
    name: `quarterDistribution.${yearIndex}`,
  });

  const basePath = `quarterDistribution.${yearIndex}`;

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[180px] text-xs">Статья</TableHead>
          {QUARTERS.map(({ label }) => (
            <TableHead key={label} className="w-[100px] text-right text-xs">
              {label}
            </TableHead>
          ))}
          <TableHead className="w-[110px] pr-3 text-right text-xs">
            Итого
          </TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {ROW_CONFIGS.map((row) => {
          const rowTotal = yearData ? calcRowTotal(yearData[row.key]) : 0;

          return (
            <TableRow key={row.key} className="hover:bg-muted/40">
              <TableCell className="py-1">
                <span
                  className={cn(
                    "flex items-center gap-2 text-sm",
                    row.colorClass,
                  )}>
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      row.dotClass,
                    )}
                  />
                  <span className="leading-tight">{row.label}</span>
                </span>
              </TableCell>
              {QUARTERS.map(({ key }) => (
                <TableCell key={key} className="p-0">
                  <AmountInput name={`${basePath}.${row.key}.${key}`} />
                </TableCell>
              ))}
              <TotalCell value={rowTotal} className={row.colorClass} />
            </TableRow>
          );
        })}

        <TableRow className="bg-muted/50 hover:bg-muted/50 font-medium">
          <TableCell className="text-muted-foreground py-2 text-sm">
            Итого по году
          </TableCell>

          {QUARTERS.map(({ key }) => (
            <TotalCell
              key={key}
              value={yearData ? calcColTotal(yearData, key) : 0}
            />
          ))}

          <TotalCell
            value={yearData ? calcYearTotal(yearData) : 0}
            className="text-foreground"
          />
        </TableRow>
      </TableBody>
    </Table>
  );
}

function SummaryCards() {
  const allYears: YearDistribution[] =
    useWatch({ name: "quarterDistribution" }) ?? [];

  const totals = ROW_CONFIGS.map((row) => ({
    ...row,
    total: allYears.reduce(
      (sum, year) => sum + calcRowTotal(year?.[row.key] ?? {}),
      0,
    ),
  }));

  return (
    <div className="mt-4 grid grid-cols-3 gap-3">
      {totals.map((row) => (
        <div key={row.key} className="bg-muted/30 rounded-lg border px-4 py-3">
          <p className="text-muted-foreground mb-1 flex items-center gap-1.5 text-xs">
            <span className={cn("h-2 w-2 rounded-full", row.dotClass)} />
            {row.label}
          </p>
          <p
            className={cn(
              "text-base font-medium tabular-nums",
              row.colorClass,
            )}>
            {row.total > 0 ? row.total.toLocaleString("ru-RU") : "0"}
          </p>
        </div>
      ))}
    </div>
  );
}

export function EditableTable() {
  const { control } = useFormContext();

  const { fields, append, remove } = useFieldArray({
    control,
    name: "quarterDistribution",
  });

  const handleAddYear = () => {
    const lastYear: number =
      fields.length > 0
        ? (fields[fields.length - 1] as { id: string; year: number })?.year + 1
        : new Date().getFullYear();

    append({
      id: lastYear.toString(),
      year: lastYear,
      financing: { q1: 0, q2: 0, q3: 0, q4: 0 },
      plan: { q1: 0, q2: 0, q3: 0, q4: 0 },
      transfer: { q1: 0, q2: 0, q3: 0, q4: 0 },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Распределение по кварталам</h3>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Суммы в тыс. руб.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddYear}
          className="h-8 gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" />
          Добавить год
        </Button>
      </div>

      {(fields as YearDistribution[]).map((field, index) => {
        const year = field?.year;

        return (
          <div key={field.id} className="overflow-hidden rounded-lg border">
            <div className="bg-muted/50 flex items-center justify-between border-b px-3 py-2">
              <span className="text-sm font-medium">{year} год</span>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive h-6 w-6"
                  onClick={() => remove(index)}
                  aria-label={`Удалить ${year} год`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <YearTable yearIndex={index} />
          </div>
        );
      })}
      {fields.length > 1 && <SummaryCards />}
    </div>
  );
}
