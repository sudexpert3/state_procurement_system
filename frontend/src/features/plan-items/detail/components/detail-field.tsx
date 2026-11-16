import type { ReactNode } from "react";

import { cn } from "@siberiacancode/reactuse";

export const DetailField = ({
  label,
  value,
  /** Иконка-действие рядом с подписью (например, кнопка редактирования поля) */
  action,
  className,
}: {
  label: string;
  value?: ReactNode;
  action?: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col gap-1", className)}>
    <div className="flex items-center gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      {action}
    </div>
    <span className="text-base font-medium wrap-break-word">
      {value === undefined || value === null || value === "" ? "—" : value}
    </span>
  </div>
);
