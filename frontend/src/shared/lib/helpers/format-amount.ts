export function formatAmount(value: number): string {
  if (value === 0) return "—";
  return value.toLocaleString("ru-RU");
}
