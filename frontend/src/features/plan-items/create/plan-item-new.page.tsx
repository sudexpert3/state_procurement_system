import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/shared/components/ui/button";
import { ROUTES } from "@/shared/model/routes";

import { contractsMock } from "./form/contract-section/contracts.mock";
import { FormPlanItem } from "./form/form";
import {
  type PlanItemFormInput,
  type PlanItemFormOutput,
  planItemSchema,
} from "./schema";

const PlanItemNewPage = () => {
  const navigate = useNavigate();

  const onCancel = () => {
    navigate(ROUTES.HOME);
  };
  const [submitted, setSubmitted] = useState<null | PlanItemFormOutput>(null);

  const defaultValues: PlanItemFormInput = {
    goodsName: "",
    planPointNumber: "",
    allVolume: 0,
    planItems: [],
    okrbName: "",
    typeOfGoodsId: "",
    customerId: "",
    allCost: 0,
    okrbCode: "",
    expenseCategory: "",
    units: "",
    currentPlanBalance: 0,
    customerAccounts: [],
    contracts: contractsMock,
    itemList: "",
    planChangeDate: new Date(),
    planDate: new Date(),
    planNumber: 0,
    viewObject: "",
    viewProcedure: "",
  };

  const form = useForm<PlanItemFormInput, unknown, PlanItemFormOutput>({
    defaultValues,
    mode: "onChange",
    resolver: zodResolver(planItemSchema),
  });

  const onSubmit = (data: PlanItemFormOutput) => {
    toast.info("Данные формы");
    setSubmitted(data);
  };

  const handleReset = () => {
    form.reset(defaultValues);
    setSubmitted(null);
  };

  return (
    <div>
      <div className="flex justify-between py-2">
        <div>
          <h1 className="text-2xl font-bold">Создание нового плана</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={handleReset}>
            Очистить форму
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Отмена
          </Button>
          <Button variant="outline">Сохранить как черновик</Button>
          <Button form="plan-item-form" type="submit">
            Сохранить
          </Button>
        </div>
      </div>

      <div className="mt-4 mb-10">
        <FormProvider {...form}>
          <FormPlanItem submitted={submitted} onSubmit={onSubmit} />
        </FormProvider>
      </div>
    </div>
  );
};

export const Component = PlanItemNewPage;
