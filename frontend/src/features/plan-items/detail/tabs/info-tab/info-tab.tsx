import type { PlanItemFull } from "@/shared/api/schema";

import { useState } from "react";

import { PlusIcon } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { CardContent } from "@/shared/components/ui/card";
import { formatByn, formatMoney } from "@/shared/lib/helpers/format-money";

import { DepartmentsTable } from "../../components/departments-table";
import { DetailField } from "../../components/detail-field";
import { SectionCard } from "../../components/section-card";
import { typeLabel } from "../../plan-meta";

import { CostDepartmentDrawer } from "./cost-department-drawer";

const getTypeLabel = (type: string) =>
  type in typeLabel ? typeLabel[type as keyof typeof typeLabel] : type;

export const InfoTab = ({ plan }: { plan: PlanItemFull }) => {
  const [selectedEconomicDetailId, setSelectedEconomicDetailId] = useState<
    number | null
  >(null);

  const selectedEconomicDetail = plan.economic_details.find(
    (detail) => detail.id === selectedEconomicDetailId,
  );

  const selectedCostDepartments =
    selectedEconomicDetail?.cost_departments ?? [];

  return (
    <div className="space-y-4">
      <SectionCard title="Предмет закупки">
        <CardContent className="grid grid-cols-2 gap-4 px-2 md:grid-cols-3">
          <DetailField label="Номер пункта плана" value={plan.num} />
          <DetailField label="Код ОКРБ" value={plan.okrb} />
          <DetailField label="Наименование по ОКРБ" value={plan.okrb_title} />
          <DetailField
            label="Наименование предмета закупки"
            value={plan.title}
          />
          <DetailField
            label="Тип (работа/услуга/товар)"
            value={getTypeLabel(plan.type)}
          />
          <DetailField
            label="Исполнитель"
            value={plan.buyer_detail?.[0]?.shot_name ?? "Нет исполнителя"}
          />
          <DetailField label="Общее количество" value={plan.val_amount} />
          <DetailField label="Ед. измерения" value={plan.val_unit} />
          <DetailField
            label="Общая сумма"
            value={formatMoney(plan.aggregated_cost.total_cost)}
          />
        </CardContent>
      </SectionCard>
      <SectionCard title="Сведения о финансировании">
        {plan.economic_details.length === 0 ? (
          <CardContent className="px-2">
            <p className="text-muted-foreground text-sm">
              По этому плану сведений о финансировании нет.
            </p>
          </CardContent>
        ) : (
          plan.economic_details.map((year) => {
            return (
              <CardContent
                key={year.id}
                className="grid grid-cols-2 gap-4 px-2 md:grid-cols-3">
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
                  value={`${year?.internal_economic_class_detail?.code} - ${year?.internal_economic_class_detail?.name}`}
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
                  actions={
                    <Button
                      onClick={() => setSelectedEconomicDetailId(year.id)}>
                      <PlusIcon size={16} />
                      Добавить подразделение
                    </Button>
                  }
                />
              </CardContent>
            );
          })
        )}
      </SectionCard>
      <CostDepartmentDrawer
        open={selectedEconomicDetailId !== null}
        excludedDepartmentIds={selectedCostDepartments.map(
          (department) => department.department_detail.id,
        )}
        onClose={() => setSelectedEconomicDetailId(null)}
      />
    </div>
  );
};
