import type { TreasuryPayment } from "@/shared/api/schema";

import { formatByn } from "@/shared/lib/helpers/format-money";

type Props = {
  // Полный список платежей, подходящих под текущие фильтры (не только
  // текущая страница) — отдельный запрос с большим limit, см.
  // payments.page.tsx. Пока он не пришёл — показываем "считается...", как
  // и в registry-money-summary.tsx на "Реестре закупок".
  items: TreasuryPayment[] | undefined;
  isLoading: boolean;
};

export const PaymentsMoneySummary = ({ items, isLoading }: Props) => {
  if (isLoading || !items) {
    return <span className="text-muted-foreground">Сумма: считается…</span>;
  }

  const total = items.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);

  return (
    <span className="text-muted-foreground">Сумма: {formatByn(total)}</span>
  );
};
