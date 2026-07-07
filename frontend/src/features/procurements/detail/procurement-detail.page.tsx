import { useParams } from "react-router";

import { Badge } from "@/shared/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";
import { formatMoney } from "@/shared/lib/helpers/format-money";
import { cn } from "@/shared/lib/utils";

import { ContractsTab } from "./tabs/contracts-tab";
import { InfoTab } from "./tabs/info-tab";
import { PaymentsTab } from "./tabs/payments-tab";
import { PlanningTab } from "./tabs/planning-tab";
import { DetailField } from "./detail-field";
import { statusMeta } from "./plan-meta";
import { procurementDetailMock } from "./procurement.mock";

const ProcurementDetailPage = () => {
  // ID берём из URL (а не из location.state) — так страница переживает
  // перезагрузку (F5) и открытие по прямой ссылке.
  const { id } = useParams();

  // ─── Заготовки запросов ───────────────────────────────────────────────
  // Пока данные из мока. Включим, когда бэкенд отдаст эндпоинты.
  // const { data: plan, isLoading } = rqClient.useQuery(
  //   "get",
  //   "/api/procurements/{id}/",
  //   { params: { path: { id: Number(id) } } },
  // );
  // ──────────────────────────────────────────────────────────────────────
  const plan = procurementDetailMock.find((p) => String(p.id) === id);

  if (!plan) {
    return (
      <div className="text-muted-foreground p-6 text-sm">
        План с номером {id} не найден.
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Шапка плана */}
      <Card className="ring-0">
        <CardHeader className="px-2">
          <CardTitle className="text-lg font-semibold tracking-wide uppercase">
            План закупки № {plan.planPointNumber}
          </CardTitle>
          <CardAction>
            <Badge
              className={cn(
                "rounded-md px-3 py-1 text-sm font-semibold",
                statusMeta[plan.status].className,
              )}>
              {statusMeta[plan.status].label}
            </Badge>
          </CardAction>
        </CardHeader>
        <Separator />
        <CardContent className="grid grid-cols-2 gap-4 px-2 md:grid-cols-4">
          <DetailField
            label="Номер пункта плана"
            value={plan.planPointNumber}
          />
          <DetailField
            label="Наименование предмета закупки"
            value={plan.goodsName}
          />
          <DetailField
            label="Общее количество"
            value={`${plan.allVolume} ${plan.units}`}
          />
          <DetailField label="Общая сумма" value={formatMoney(plan.allCost)} />
        </CardContent>
      </Card>

      {/* Табы с секциями плана */}
      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info">Информация</TabsTrigger>
          <TabsTrigger value="planning">Планирование</TabsTrigger>
          <TabsTrigger value="contracts">
            Договоры
            {plan.contracts.length > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {plan.contracts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="payments">Платежи</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <InfoTab plan={plan} />
        </TabsContent>

        <TabsContent value="planning">
          <PlanningTab plan={plan} />
        </TabsContent>

        <TabsContent value="contracts">
          <ContractsTab plan={plan} />
        </TabsContent>

        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export const Component = ProcurementDetailPage;
