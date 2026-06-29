import type { ContractItem } from "./contract.schema";
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

// --- Производные суммы для read-only карточки договора ---
// В форме не хранятся (по CLAUDE.md «производное — не state»), считаются на лету.

// Сумма всего профинансированного (оплачено) по всем годам договора
export const calcContractFinanced = (contract: ContractItem): number =>
  contract.quarterDistribution.reduce(
    (sum, year) => sum + calcRowTotal(year.financing),
    0,
  );

// Сумма принятых обязательств: сумма договора, если известна, иначе сумма плана
export const calcTotalLiabilities = (
  contract: ContractItem,
  currentPlanBalance: number,
): number => (contract.contractSum > 0 ? contract.contractSum : currentPlanBalance);

// Отклонение план/договор
// TODO: формула предположительная — уточнить у бизнеса
export const calcVariance = (
  contract: ContractItem,
  currentPlanBalance: number,
): number => currentPlanBalance - contract.contractSum;

// Остаток от договора = сумма договора минус профинансировано
// TODO: формула предположительная — уточнить у бизнеса
export const calcRemainingBalance = (contract: ContractItem): number =>
  contract.contractSum - calcContractFinanced(contract);
