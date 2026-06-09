import type { QuarterRow, YearDistribution } from "./quarter.schema";

export const calcRowTotal = (row: QuarterRow): number =>
  [row.q1, row.q2, row.q3, row.q4].reduce<number>((s, v) => s + (v ?? 0), 0);

export const calcColTotal = (
  year: YearDistribution,
  q: keyof QuarterRow,
): number =>
  [year.financing[q], year.plan[q], year.transfer[q]].reduce<number>(
    (s, v) => s + (v ?? 0),
    0,
  );

export const calcYearTotal = (year: YearDistribution): number =>
  calcRowTotal(year.financing) +
  calcRowTotal(year.plan) +
  calcRowTotal(year.transfer);

export function formatAmount(value: number): string {
  if (value === 0) return "—";
  return value.toLocaleString("ru-RU");
}
