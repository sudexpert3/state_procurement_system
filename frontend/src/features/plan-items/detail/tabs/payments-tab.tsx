import { SectionCard } from "@/shared/components/section-card";
import { CardContent } from "@/shared/components/ui/card";

export const PaymentsTab = () => (
  <SectionCard title="Платежи">
    <CardContent className="text-muted-foreground px-2 text-sm">
      Список платежей появится после подключения эндпоинта.
    </CardContent>
  </SectionCard>
);
