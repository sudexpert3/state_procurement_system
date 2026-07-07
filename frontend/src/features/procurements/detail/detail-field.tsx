import type { ReactNode } from "react";

// Read-only отображение одного поля: подпись сверху, значение снизу.
// Пустое значение показываем как «—».
export const DetailField = ({
  label,
  value,
}: {
  label: string;
  value?: ReactNode;
}) => (
  <div className="flex flex-col gap-1">
    <span className="text-muted-foreground text-xs">{label}</span>
    <span className="text-sm font-medium">
      {value === undefined || value === null || value === "" ? "—" : value}
    </span>
  </div>
);
