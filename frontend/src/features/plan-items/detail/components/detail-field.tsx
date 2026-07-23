import type { ReactNode } from "react";

import { cn } from "@siberiacancode/reactuse";

export const DetailField = ({
  label,
  value,
  className,
}: {
  label: string;
  value?: ReactNode;
  className?: string;
}) => (
  <div className={cn("flex flex-col gap-1", className)}>
    <span className="text-muted-foreground text-xs">{label}</span>
    <span className="text-sm font-medium wrap-break-word">
      {value === undefined || value === null || value === "" ? "—" : value}
    </span>
  </div>
);
