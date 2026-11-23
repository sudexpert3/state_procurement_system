import type { OverspendSummaryLine } from "@/shared/api/schema";

import { TriangleAlertIcon } from "lucide-react";

import { formatByn } from "@/shared/lib/helpers/format-money";

type Props = {
  lines: OverspendSummaryLine[];
};

// Перерасход не блокируется бэкендом (решение пользователя 2026-11-23) —
// только предупреждение здесь, над таблицей.
export const OverspendBanner = ({ lines }: Props) => {
  if (lines.length === 0) return null;

  return (
    <div className="border-destructive/30 bg-destructive/10 flex flex-col gap-2 rounded-md border p-3">
      <div className="text-destructive flex items-center gap-2 text-sm font-medium">
        <TriangleAlertIcon size={16} />
        Перерасход по статьям за выбранный год
      </div>
      <ul className="text-destructive flex flex-col gap-1 text-sm">
        {lines.map((line) => (
          <li key={`${line.functional_class}-${line.economic_class}`}>
            {line.economic_code} (параграф {line.functional_code}) — перебор на{" "}
            {formatByn(line.overspend_amount)}
          </li>
        ))}
      </ul>
    </div>
  );
};
