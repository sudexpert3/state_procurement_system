import type { EconomicInfo } from "@/services/contracts";
import type { PlanItemFull } from "@/shared/api/schema";

import { useMemo } from "react";

import { ContractDetailBody } from "@/services/contracts";
import { SectionCard } from "@/shared/components/section-card";
import { CardContent } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatMoney } from "@/shared/lib/helpers/format-money";
import { cn } from "@/shared/lib/utils";

import { StatCard } from "../components/stat-card";

import { ContractPickerList, usePlanItemContracts } from "./contract-picker";

// Таб «Договоры» на карточке позиции плана — договоры, привязанные к этому
// пункту через ContractItem (фильтр `?plan_item=` бэкенд добавил 2026-11-17,
// см. CurrentStatus.md). 0 → сообщение, 1 → сразу карточка, >1 → список +
// карточка выбранного.
export const ContractsTab = ({ plan }: { plan: PlanItemFull }) => {
  const { contracts, isLoading, selectedContract, setSelectedId } =
    usePlanItemContracts(plan.id);

  // Строка спецификации договора (ContractItem) хранит только id PlanShare,
  // без названия подразделения — а на этой странице все PlanShare пункта
  // плана уже загружены (plan.economic_details[].cost_departments), так что
  // достаём имя из них, не делая лишних запросов. CostDepartment.id — это и
  // есть id PlanShare (ContractItem.plan_share ссылается на ту же запись).
  const departmentByPlanShare = useMemo(() => {
    const map = new Map<number, string>();
    plan.economic_details.forEach((detail) => {
      detail.cost_departments.forEach((costDepartment) => {
        map.set(costDepartment.id, costDepartment.department_detail.short_name);
      });
    });
    return map;
  }, [plan.economic_details]);

  // Та же карта по PlanShare, но для экономического кода (внешний,
  // goszakupki.by) и кода ЭКР внутреннего (классификатор ГКСЭ) статьи
  // бюджета — используется в колонках таблиц «Спецификация» и
  // «Квартальный план/факт» (см. ContractDetailBody).
  const economicInfoByPlanShare = useMemo(() => {
    const map = new Map<number, EconomicInfo>();
    plan.economic_details.forEach((detail) => {
      const economicCode = detail.economic_class_detail.code_api;
      const internalEkrCode = detail.internal_economic_class_detail.code;
      detail.cost_departments.forEach((costDepartment) => {
        map.set(costDepartment.id, { economicCode, internalEkrCode });
      });
    });
    return map;
  }, [plan.economic_details]);

  const planTotal = Number(plan.aggregated_cost?.total_cost ?? 0);
  const contractsTotal = useMemo(
    () => contracts.reduce((sum, c) => sum + Number(c.total_cost), 0),
    [contracts],
  );
  const balance = planTotal - contractsTotal;

  return (
    <SectionCard title="Договоры">
      <CardContent className="space-y-4 px-2">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : contracts.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            По этому пункту плана договоров нет.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-4 md:flex-row">
              <StatCard
                title="Общая сумма позиции"
                value={formatMoney(planTotal)}
              />
              <StatCard
                title="Сумма всех договоров"
                value={formatMoney(contractsTotal)}
              />
              <StatCard
                title="Остаток денег по пункту"
                value={formatMoney(balance)}
                valueClassName={cn(balance < 0 && "text-destructive")}
              />
            </div>

            {contracts.length > 1 && (
              <ContractPickerList
                contracts={contracts}
                onSelect={(c) => setSelectedId(c.id)}
              />
            )}

            {selectedContract ? (
              <div className="rounded-md border">
                <ContractDetailBody
                  contract={selectedContract}
                  departmentByPlanShare={departmentByPlanShare}
                  economicInfoByPlanShare={economicInfoByPlanShare}
                />
              </div>
            ) : (
              contracts.length > 1 && (
                <p className="text-muted-foreground text-sm">
                  Выберите договор в списке выше.
                </p>
              )
            )}
          </>
        )}
      </CardContent>
    </SectionCard>
  );
};
