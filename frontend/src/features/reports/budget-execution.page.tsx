import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

import { BudgetExecutionTab } from "./budget-execution-tab";

const BudgetExecutionPage = () => (
  <Card className="max-w-full gap-2 bg-transparent ring-0">
    <CardHeader>
      <CardTitle>Оперативный отчёт</CardTitle>
      <CardDescription>
        Назначено — обязательства — оплачено — остаток
      </CardDescription>
    </CardHeader>
    <CardContent>
      <BudgetExecutionTab />
    </CardContent>
  </Card>
);

export const Component = BudgetExecutionPage;
