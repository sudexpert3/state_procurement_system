import type { PlanItemFull } from "@/shared/api/schema";

import { CardContent } from "@/shared/components/ui/card";
import { formatByn, formatMoney } from "@/shared/lib/helpers/format-money";

import { DepartmentsTable } from "../components/departments-table";
import { DetailField } from "../components/detail-field";
import { SectionCard } from "../components/section-card";
import { typeLabel } from "../plan-meta";

// Таб «Информация» — скалярные поля предмета закупки + сведения о финансировании.
export const InfoTab = ({ plan }: { plan: PlanItemFull }) => (
  <div className="space-y-4">
    <SectionCard title="Предмет закупки">
      <CardContent className="grid grid-cols-2 gap-4 px-2 md:grid-cols-3">
        <DetailField label="Номер пункта плана" value={plan.num} />
        <DetailField label="Код ОКРБ" value={plan.okrb} />
        <DetailField label="Наименование по ОКРБ" value={plan.okrb_title} />
        <DetailField label="Наименование предмета закупки" value={plan.title} />
        <DetailField
          label="Тип (работа/услуга/товар)"
          value={typeLabel[plan.type]}
        />
        //TODO узнать про исполнителя
        {/* <DetailField label="Исполнитель" value={plan.customerId} /> */}
        <DetailField label="Общее количество" value={plan.val_amount} />
        <DetailField label="Ед. измерения" value={plan.val_unit} />
        <DetailField
          label="Общая сумма"
          value={formatMoney(plan.aggregated_cost.total_cost)}
        />
      </CardContent>
    </SectionCard>
    <SectionCard title="Сведения о финансировании">
      <CardContent className="space-y-3 px-2">
        {plan.economic_details.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            По этому плану сведений о финансировании нет.
          </p>
        ) : (
          plan.economic_details.map((year, idx) => (
            <div
              // key={year?.year + idx}
              className="grid grid-cols-2 gap-4 rounded-md border p-3 md:grid-cols-3">
              <DetailField label="Год финансирования" value={year.year} />
              <DetailField
                label="Сумма финансирования года, BYN"
                value={formatByn(year.cost_detail.total_cost)}
              />
              <DetailField
                label="Функциональная классификация"
                value={year.functional_class_detail.description}
              />
              <DetailField
                label="Экономическая классификация"
                value={year.economic_class_detail.description}
              />
              <DetailField
                label="Экономическая классификация внутренняя"
                value={`${year.internal_economic_class_detail.code} - ${year.internal_economic_class_detail.name}`}
              />
              <DetailField
                label="Программная классификация"
                value={year.program_class_detail.description}
              />
              <DetailField
                label="Ведомственная классификация"
                value={year.department_code}
              />
              <DetailField label="УНК заказчика" value={year.unk} />
              <DetailField label="Код ТК" value={year.tk_id} />
              <DetailField label="Код бюджета" value={year.budget_code} />
              <DetailField
                label="Наименование кода бюджета"
                value={year.budget_code_name}
              />
              <DetailField
                label="Оплата со счетов казначейства, BYN"
                value={formatByn(year.cost_detail.budget_cost)}
              />
              <DetailField
                label="Оплата со счетов заказчика, BYN"
                value={formatByn(year.cost_detail.fund_cost)}
              />
              <DetailField
                label="Собственные средства, BYN"
                value={formatByn(year.cost_detail.inner_cost)}
              />
              <DepartmentsTable
                title="Сведения о финансировании подразделений"
                data={year.cost_departments}
              />
            </div>
          ))
        )}
      </CardContent>
    </SectionCard>
  </div>
);
