import { useParams } from "react-router";

import { rqClient } from "@/shared/api/instance";
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

import { DetailField } from "./components/detail-field";
import { InfoTab } from "./tabs/info-tab";
import { PaymentsTab } from "./tabs/payments-tab";

const PlanItemDetailPage = () => {
  const { id } = useParams();

  const { data: plan, isLoading } = rqClient.useQuery(
    "get",
    "/api/plan_items/{id}/",
    { params: { path: { id: Number(id) } } },
  );
  console.log(id);
  // const plan2 = planItemDetailMock.find((p) => String(p.id) === id);

  if (!plan) {
    return (
      <div className="text-muted-foreground p-6 text-sm">
        План с номером {id} не найден.
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <Card className="ring-0">
        <CardHeader className="px-2">
          <CardTitle className="text-lg font-semibold tracking-wide uppercase">
            План закупки № {plan.num}
          </CardTitle>
          <CardAction>
            //TODO узнать про статус плана
            {/* <Badge 
              className={cn(
                "rounded-md px-3 py-1 text-sm font-semibold",
                statusMeta[plan.status].className,
              )}>
              {statusMeta[plan.status].label}
            </Badge> */}
          </CardAction>
        </CardHeader>
        <Separator />
        <CardContent className="grid grid-cols-2 gap-4 px-2 md:grid-cols-4">
          <DetailField label="Номер пункта плана" value={plan.num} />
          <DetailField
            label="Наименование предмета закупки"
            value={plan.title}
          />
          <DetailField
            label="Общее количество"
            value={`${plan.val_amount} ${plan.val_unit}`}
          />
          <DetailField
            label="Общая сумма"
            value={formatMoney(plan.aggregated_cost?.total_cost)}
          />
        </CardContent>
      </Card>

      <Tabs defaultValue="info" className="w-full">
        <TabsList>
          <TabsTrigger value="info">Информация</TabsTrigger>
          <TabsTrigger value="planning">Планирование</TabsTrigger>
          <TabsTrigger value="contracts">
            Договоры
            {/* {plan2.contracts.length > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {plan2.contracts.length}
              </Badge>
            )} */}
          </TabsTrigger>
          <TabsTrigger value="payments">Платежи</TabsTrigger>
        </TabsList>

        <TabsContent value="info">
          <InfoTab plan={plan} />
        </TabsContent>

        {/* <TabsContent value="planning">
          <PlanningTab plan={plan2} />
        </TabsContent>

        <TabsContent value="contracts">
          <ContractsTab plan={plan2} />
        </TabsContent> */}

        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export const Component = PlanItemDetailPage;
