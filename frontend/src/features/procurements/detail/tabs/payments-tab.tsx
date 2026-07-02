import { CardContent } from "@/shared/components/ui/card";

import { SectionCard } from "../section-card";

// Таб «Платежи» — плейсхолдер до подключения эндпоинта.
export const PaymentsTab = () => (
  <SectionCard title="Платежи">
    <CardContent className="text-muted-foreground px-2 text-sm">
      Список платежей появится после подключения эндпоинта.
    </CardContent>
  </SectionCard>
);
