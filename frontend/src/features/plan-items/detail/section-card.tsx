import type { ReactNode } from "react";

import { Card, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";

// Карточка-секция: заголовок в едином стиле + разделитель.
// Тело передаётся через children (обычно CardContent со своей раскладкой).
export const SectionCard = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <Card className="ring-0">
    <CardHeader className="px-2">
      <CardTitle className="text-base font-semibold tracking-wide uppercase">
        {title}
      </CardTitle>
    </CardHeader>
    <Separator />
    {children}
  </Card>
);
