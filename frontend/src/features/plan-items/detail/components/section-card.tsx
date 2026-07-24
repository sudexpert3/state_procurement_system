import type { ReactNode } from "react";

import {
  Card,
  CardAction,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";

export const SectionCard = ({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) => (
  <Card className="ring-0">
    <CardHeader className="flex items-center justify-between px-2">
      <CardTitle className="text-base font-semibold tracking-wide uppercase">
        {title}
      </CardTitle>
      <CardAction>{actions}</CardAction>
    </CardHeader>
    <Separator />
    {children}
  </Card>
);
