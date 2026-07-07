import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/utils";

export const DataTableCell = ({
  className,
  ...props
}: ComponentProps<"div">) => {
  return <div className={cn(className)} {...props} />;
};

export const DataTableColumnHeader = ({
  className,
  ...props
}: ComponentProps<"div">) => {
  return <div className={cn(className)} {...props} />;
};

export const DataTableCellList = ({
  items,
  className,
  ...props
}: ComponentProps<"div"> & { items: readonly (string | number)[] }) => {
  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      {items.map((item, idx) => (
        <div key={idx}>{item}</div>
      ))}
    </div>
  );
};
