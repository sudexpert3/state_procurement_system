import { useNavigate } from "react-router";

import { DataTable } from "@/shared/components/data-table/data-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { ROUTES } from "@/shared/model/routes";

import { columns } from "./columns";
import { plansMock } from "./plans.mock";

const PlansPage = () => {
  const navigate = useNavigate();

  // Клик по строке ведёт в реестр закупок выбранного плана
  const handleRowClick = () => {
    navigate(ROUTES.PROCUREMENTS);
  };

  return (
    <Card className="max-w-full gap-2 bg-transparent ring-0">
      <CardHeader>
        <CardTitle>Годовые планы</CardTitle>
        <CardDescription className="text-[12px]">
          Реестр годовых планов государственных закупок
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable data={plansMock} columns={columns} getRow={handleRowClick} />
      </CardContent>
    </Card>
  );
};

export const Component = PlansPage;
