import type { Buyer, PlanItemFull } from "@/shared/api/schema";

import { useCallback } from "react";

import { useCurrentUser } from "@/services/auth";
import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";
import { DetailField } from "@/shared/components/detail-field";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import { formatMoney } from "@/shared/lib/helpers/format-money";

import { typeLabel } from "../plan-meta";

import { EditableBuyerField } from "./editable-buyer-field";

const getTypeLabel = (type: string) =>
  type in typeLabel ? typeLabel[type as keyof typeof typeLabel] : type;

// Сводка по предмету закупки — общий для всех вкладок карточки позиции
// плана блок над табами (раньше часть этих же полей дублировалась в табе
// «Информация», см. CurrentStatus.md).
export const SubjectInfoCard = ({ plan }: { plan: PlanItemFull }) => {
  const { data: currentUser } = useCurrentUser();
  // Прямое редактирование исполнителя (минуя заявку на изменение) —
  // доступно только этим двум ролям, см. core/choices.py (описание прав
  // FINANCIER).
  const canEditDirectly =
    currentUser?.role === "ADMIN_MAIN" || currentUser?.role === "FINANCIER";

  // Для PATCH /api/plan_items_details/{id}/ нужен id активной версии
  // PlanItemDetail — PlanItemFull.id (из /api/plan_items/{id}/) это id
  // корневого неизменяемого PlanItem, другая сущность.
  const activeDetailQuery = rqClient.useQuery(
    "get",
    "/api/plan_items_details/",
    { params: { query: { plan_item: plan.id, status: "ACTIVE" } } },
    { enabled: canEditDirectly },
  );
  const activeDetailId = activeDetailQuery.data?.results[0]?.id ?? null;

  const invalidate = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: ["get", "/api/plan_items/{id}/"],
      }),
    [],
  );

  return (
    <Card className="ring-0">
      <CardHeader className="px-2">
        <CardTitle className="text-lg font-semibold tracking-wide uppercase">
          План закупки № {plan.num}
        </CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="grid grid-cols-2 gap-4 px-2 md:grid-cols-3">
        <DetailField label="Номер пункта плана" value={plan.num} />
        <DetailField label="Код ОКРБ" value={plan.okrb} />
        <DetailField label="Наименование по ОКРБ" value={plan.okrb_title} />
        <DetailField label="Наименование предмета закупки" value={plan.title} />
        <DetailField
          label="Тип (работа/услуга/товар)"
          value={getTypeLabel(plan.type)}
        />
        <EditableBuyerField
          detailId={activeDetailId}
          // В OpenAPI-схеме buyer_detail типизирован как массив (Buyer[]),
          // но реально бэкенд всегда отдаёт один объект Buyer — см.
          // CurrentStatus.md, раздел "хвосты бэка".
          currentBuyer={plan.buyer_detail as unknown as Buyer | null}
          canEdit={canEditDirectly}
          onSuccess={invalidate}
        />
        <DetailField label="Общее количество" value={plan.val_amount} />
        <DetailField label="Ед. измерения" value={plan.val_unit} />
        <DetailField
          label="Общая сумма"
          value={formatMoney(plan.aggregated_cost.total_cost)}
        />
      </CardContent>
    </Card>
  );
};
