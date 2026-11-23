import type { Contract } from "@/shared/api/schema";

import { formatByn } from "@/shared/lib/helpers/format-money";

type Props = {
  // Полный список договоров, подходящих под текущие поиск/фильтры (не
  // только текущая страница) — отдельный запрос с большим limit, см.
  // contracts.page.tsx. Пока он не пришёл — показываем "считается...", как
  // и в registry-money-summary.tsx на "Реестре закупок".
  items: Contract[] | undefined;
  isLoading: boolean;
};

export const ContractsMoneySummary = ({ items, isLoading }: Props) => {
  if (isLoading || !items) {
    return <span className="text-muted-foreground">Сумма: считается…</span>;
  }

  const total = items.reduce((sum, item) => sum + Number(item.total_cost), 0);

  return (
    <span className="text-muted-foreground">Сумма: {formatByn(total)}</span>
  );
};
