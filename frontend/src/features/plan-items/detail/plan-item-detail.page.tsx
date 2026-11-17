import type { PlanItemFull } from "@/shared/api/schema";

import { useParams } from "react-router";

import { rqClient } from "@/shared/api/instance";
import { Card } from "@/shared/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";

import { PlanItemDetailSkeleton } from "./components/plan-item-detail-skeleton";
import { SubjectInfoCard } from "./components/subject-info-card";
import { ChangeRequestTab } from "./tabs/change-request-tab";
import { ContractsTab } from "./tabs/contracts-tab";
import { InfoTab } from "./tabs/info-tab";
import { PaymentsTab } from "./tabs/payments-tab";

const PlanItemDetailPage = () => {
  const { id } = useParams();

  const { data, isLoading, isError } = rqClient.useQuery(
    "get",
    "/api/plan_items/{id}/",
    {
      params: { path: { id: Number(id) } },
    },
  );
  const plan = data as unknown as PlanItemFull | undefined;
  // const plan2 = planItemDetailMock.find((p) => String(p.id) === id);

  if (isError) {
    return (
      <div className="text-muted-foreground p-6 text-sm">
        План с номером {id} не найден.
      </div>
    );
  }

  if (isLoading) {
    return <PlanItemDetailSkeleton />;
  }

  return (
    <>
      {!isError && plan && (
        <div className="w-full space-y-4">
          <SubjectInfoCard plan={plan} />

          <Tabs defaultValue="info" className="w-full gap-4">
            {/* Та же акцентная схема (variant="line" + chart-4), что и в
                табах создания позиции (form-tabs-navigation.tsx) — разделы
                карточки раньше терялись на фоне страницы (bg-accent их почти
                не отличал от bg-background), активная вкладка была различима
                только по еле заметному оттенку текста. */}
            <Card className="gap-0 p-0 ring-0">
              <TabsList
                variant="line"
                className="bg-accent w-full justify-start border-b group-data-horizontal/tabs:h-11">
                <TabsTrigger
                  value="info"
                  className="data-active:text-chart-4 after:bg-chart-4 hover:text-chart-4 text-[15px] font-medium transition-colors">
                  Финансирование
                </TabsTrigger>
                <TabsTrigger
                  value="planning"
                  className="data-active:text-chart-4 after:bg-chart-4 hover:text-chart-4 text-[15px] font-medium transition-colors">
                  Планирование
                </TabsTrigger>
                <TabsTrigger
                  value="contracts"
                  className="data-active:text-chart-4 after:bg-chart-4 hover:text-chart-4 text-[15px] font-medium transition-colors">
                  Договоры
                  {/* {plan2.contracts.length > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {plan2.contracts.length}
              </Badge>
            )} */}
                </TabsTrigger>
                <TabsTrigger
                  value="payments"
                  className="data-active:text-chart-4 after:bg-chart-4 hover:text-chart-4 text-[15px] font-medium transition-colors">
                  Платежи
                </TabsTrigger>
                <TabsTrigger
                  value="change-request"
                  className="data-active:text-chart-4 after:bg-chart-4 hover:text-chart-4 text-[15px] font-medium transition-colors">
                  Заявка на изменение
                </TabsTrigger>
              </TabsList>
            </Card>

            <TabsContent value="info">
              <InfoTab plan={plan} />
            </TabsContent>

            {/* <TabsContent value="planning">
          <PlanningTab plan={plan2} />
        </TabsContent> */}

            <TabsContent value="contracts">
              <ContractsTab plan={plan} />
            </TabsContent>

            <TabsContent value="payments">
              <PaymentsTab planItemId={plan.id} />
            </TabsContent>

            <TabsContent value="change-request">
              <ChangeRequestTab planItemId={plan.id} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </>
  );
};

export const Component = PlanItemDetailPage;
