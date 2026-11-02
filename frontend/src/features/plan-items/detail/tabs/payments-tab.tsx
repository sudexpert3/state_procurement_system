import { CardContent } from "@/shared/components/ui/card";

import { SectionCard } from "../components/section-card";

export const PaymentsTab = () => (
  <SectionCard title="Платежи">
    <CardContent className="text-muted-foreground px-2 text-sm">
      Список платежей появится после подключения эндпоинта.
    </CardContent>
  </SectionCard>
);
