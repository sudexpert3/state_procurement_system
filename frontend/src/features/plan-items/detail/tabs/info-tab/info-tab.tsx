import type { CostDepartment, PlanItemFull } from "@/shared/api/schema";

import { useCallback, useState } from "react";

import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { useCurrentUser } from "@/services/auth";
import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
import { SectionCard } from "@/shared/components/section-card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { CardContent } from "@/shared/components/ui/card";
import { formatByn } from "@/shared/lib/helpers/format-money";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

import { DepartmentsTable } from "../../components/departments-table";
import { DetailField } from "../../components/detail-field";

import { CostDepartmentDrawer } from "./cost-department-drawer";
import { EditableInternalEconomicClassField } from "./editable-internal-economic-class-field";

type DrawerState = { economicDetailId: number; item: CostDepartment | null };

export const InfoTab = ({ plan }: { plan: PlanItemFull }) => {
  const [drawerState, setDrawerState] = useState<DrawerState | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Прямое редактирование (минуя заявку на изменение) внутренней
  // классификации ЭКР — доступно только этим двум ролям, см. core/choices.py
  // (описание прав FINANCIER) и CurrentStatus.md.
  //
  // Было временно отключено 2026-11-16 из-за бага бэкенда (PATCH без поля
  // `status` сбрасывал ACTIVE → DRAFT в PlanItemDetailSerializer.update()/
  // BudgetCostsSerializer.update()) — бэкенд исправил и восстановил
  // повреждённые записи (см. CurrentStatus.md, корневой), включено обратно.
  const { data: currentUser } = useCurrentUser();
  const canEditDirectly =
    currentUser?.role === "ADMIN_MAIN" || currentUser?.role === "FINANCIER";

  const selectedEconomicDetail = plan.economic_details.find(
    (detail) => detail.id === drawerState?.economicDetailId,
  );

  const selectedCostDepartments =
    selectedEconomicDetail?.cost_departments ?? [];

  const invalidate = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: ["get", "/api/plan_items/{id}/"],
      }),
    [],
  );

  const deleteMutation = rqClient.useMutation(
    "delete",
    "/api/plan_shares/{id}/",
  );

  const handleDelete = useCallback(
    (item: CostDepartment) => {
      setDeletingId(item.id);
      deleteMutation.mutate(
        { params: { path: { id: item.id } } },
        {
          onSuccess: () => {
            setDeletingId(null);
            invalidate();
            toast.success("Распределение удалено");
          },
          onError: (error) => {
            setDeletingId(null);
            handleHttpError(error, "Не удалось удалить распределение", true);
          },
        },
      );
    },
    [deleteMutation, invalidate],
  );

  return (
    <div className="space-y-4">
      <SectionCard title="Сведения о финансировании">
        {plan.economic_details.length === 0 ? (
          <CardContent className="px-2">
            <p className="text-muted-foreground text-sm">
              По этому плану сведений о финансировании нет.
            </p>
          </CardContent>
        ) : (
          <CardContent className="flex flex-col gap-4 px-2">
            {plan.economic_details.map((year) => {
              // Позиция плана может финансироваться несколькими записями
              // сразу — не только за разные годы (plan-items/3004), но и в
              // одном году за разными экономическими классификаторами
              // (plan-items/3022). Раньше записи шли подряд без разделения —
              // визуально сливались в одну простыню полей. Теперь каждая
              // запись — отдельная плитка с рамкой и своим заголовком
              // (год + код экономической классификации), чтобы сразу было
              // видно, где кончается одна запись и начинается другая.
              const economicCode = year.economic_class_detail?.code_api;

              return (
                <div
                  key={year.id}
                  className="bg-muted/30 rounded-lg border p-3">
                  <div className="mb-3 flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className="border-blue-200 bg-blue-100 px-3 py-1 text-base font-bold text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      {year.year} год
                    </Badge>
                    {economicCode && (
                      <span className="text-base font-bold text-blue-700 dark:text-blue-300">
                        {economicCode}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
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
                    <EditableInternalEconomicClassField
                      budgetCostId={year.id}
                      currentClass={year.internal_economic_class_detail ?? null}
                      canEdit={canEditDirectly}
                      onSuccess={invalidate}
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
                      className="bg-background border-2 shadow-sm"
                      actions={
                        <Button
                          onClick={() =>
                            setDrawerState({
                              economicDetailId: year.id,
                              item: null,
                            })
                          }>
                          <PlusIcon size={16} />
                          Добавить подразделение
                        </Button>
                      }
                      onEdit={(item) =>
                        setDrawerState({ economicDetailId: year.id, item })
                      }
                      onDelete={handleDelete}
                      deletingId={deletingId}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        )}
      </SectionCard>
      <CostDepartmentDrawer
        open={drawerState !== null}
        item={drawerState?.item ?? null}
        budgetCostId={drawerState?.economicDetailId ?? null}
        excludedDepartmentIds={selectedCostDepartments
          .filter((department) => department.id !== drawerState?.item?.id)
          .map((department) => department.department_detail.id)}
        onClose={() => setDrawerState(null)}
        onSuccess={invalidate}
      />
    </div>
  );
};
