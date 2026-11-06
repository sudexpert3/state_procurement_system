import type { PlanItemShort } from "@/shared/api/schema";

const formatSum = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

type RegistryMoneySummaryProps = {
  // Полный список позиций, подходящих под текущие поиск/фильтры/год (не
  // только текущая страница) — отдельный запрос с большим limit, см.
  // plans-items.page.tsx. Пока он не пришёл — показываем "считается...":
  // быстрый постраничный список и эта сумма теперь независимы (сервер
  // отвечает на маленькие запросы быстро, а на большие — всегда ~2 сек,
  // см. CurrentStatus.md), ждать её для показа самого списка не нужно.
  items: PlanItemShort[] | undefined;
  isLoading: boolean;
};

export const RegistryMoneySummary = ({
  items,
  isLoading,
}: RegistryMoneySummaryProps) => {
  if (isLoading || !items) {
    return <span className="text-muted-foreground">Сумма: считается…</span>;
  }

  let total = 0;
  const byYear = new Map<number, number>();

  items.forEach((item) => {
    total += Number(item.aggregated_cost);

    item.economic_details.forEach((detail) => {
      if (detail.year == null) return;

      byYear.set(
        detail.year,
        (byYear.get(detail.year) ?? 0) + Number(detail.full_cost),
      );
    });
  });

  // Нулевые суммы по году (например, запись на будущий год ещё без
  // распределённого финансирования) в разбивке не показываем — "Из них"
  // нужен только там, где реально что-то профинансировано.
  const years = [...byYear.entries()]
    .filter(([, sum]) => sum !== 0)
    .sort(([a], [b]) => a - b);

  return (
    <span className="text-muted-foreground">
      Сумма: {formatSum(total)} BYN
      {years.length > 1 && (
        <>
          . Из них:{" "}
          {years.map(([year, sum]) => `${year} — ${formatSum(sum)}`).join("; ")}
        </>
      )}
    </span>
  );
};
