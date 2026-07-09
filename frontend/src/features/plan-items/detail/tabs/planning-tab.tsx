import type { PlanItemDetail } from "../procurement.mock";

import { CardContent } from "@/shared/components/ui/card";
import { formatDate } from "@/shared/lib/helpers/format-date";

import { DetailField } from "../components/detail-field";
import { SectionCard } from "../components/section-card";

export const PlanningTab = ({ plan }: { plan: PlanItemDetail }) => (
  <SectionCard title="Планирование">
    <CardContent className="grid grid-cols-2 gap-4 px-2 md:grid-cols-3">
      <DetailField label="Категория расходов" value={plan.expenseCategory} />
      <DetailField label="Вид предмета" value={plan.viewObject} />
      <DetailField label="Вид процедуры" value={plan.viewProcedure} />
      <DetailField label="Позиция перечня" value={plan.itemList} />
      <DetailField label="Номер плана" value={plan.planNumber} />
      <DetailField label="Дата плана" value={formatDate(plan.planDate)} />
      <DetailField
        label="Дата изменения плана"
        value={formatDate(plan.planChangeDate)}
      />
    </CardContent>
  </SectionCard>
);
