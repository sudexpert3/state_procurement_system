import type { DepartmentArticleLimit } from "@/shared/api/schema";

import { formatByn } from "@/shared/lib/helpers/format-money";

type Props = {
  // Полный список, подходящий под текущие фильтры (не только текущая
  // страница) — отдельный запрос с большим limit, см. department-limits.page.tsx
  // (тот же приём, что в contracts-money-summary.tsx/registry-money-summary.tsx).
  // Статус по умолчанию в фильтрах — "Действующий", поэтому без явных
  // фильтров сумма сама по себе и есть "сумма всех действующих".
  items: DepartmentArticleLimit[] | undefined;
  isLoading: boolean;
};

export const DepartmentLimitsMoneySummary = ({ items, isLoading }: Props) => {
  if (isLoading || !items) {
    return <span className="text-muted-foreground">На сумму: считается…</span>;
  }

  const total = items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  return (
    <span className="text-muted-foreground">На сумму: {formatByn(total)}</span>
  );
};
