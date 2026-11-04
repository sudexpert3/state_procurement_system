import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/shared/components/ui/tabs";

import { BudgetExecutionTab } from "./budget-execution-tab";
import { GeneralMoneyTab } from "./general-money-tab";

const ReportsPage = () => (
  <Card className="max-w-full gap-2 bg-transparent ring-0">
    <CardHeader>
      <CardTitle>Отчёты</CardTitle>
      <CardDescription>
        Финансовая аналитика по статьям и подразделениям
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Tabs defaultValue="general-money" className="w-full">
        <TabsList>
          <TabsTrigger value="general-money">Общие деньги</TabsTrigger>
          <TabsTrigger value="budget-execution">
            Назначено — обязательства — оплачено — остаток
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general-money">
          <GeneralMoneyTab />
        </TabsContent>
        <TabsContent value="budget-execution">
          <BudgetExecutionTab />
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
);

export const Component = ReportsPage;
