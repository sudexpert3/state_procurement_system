import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { ROUTES } from "@/shared/model/routes";
import { Button } from "@/shared/ui/kit/button";

import { FormProcurement } from "./form/form";
import {
  type ProcurementFormInput,
  type ProcurementFormOutput,
  procurementSchema,
} from "./schema";

const ProcurementNewPage = () => {
  const navigate = useNavigate();

  const onCancel = () => {
    navigate(ROUTES.HOME);
  };
  const [submitted, setSubmitted] = useState<null | ProcurementFormOutput>(
    null,
  );

  const defaultValues: ProcurementFormInput = {
    goodsName: "",
    planPointNumber: "",
    allVolume: 0,
    procurementItems: [],
    okrbName: "",
    typeOfGoodsId: "",
    customerId: "",
    departmentId: "",
    elementNumber: 0,
    elNumber: 0,
    articleNumber: 0,
    economicClass: 0,
    pstNumber: 0,
    okrbCode: "",
    subElementNumber: 0,
    expenseCategory: "",
    units: "",
    currentPlanBalance: 0,
    customerAccounts: [],
    remainingBalance: 0.0,
    totalLiabilities: 0.0,
    variance: 0.0,
    contractNumber: "",
    contractDate: new Date(),
    supplierId: "",
    contractTerms: "",
    contractNotes: "",
    contractStatus: "",
    contractSum: 0.0,
    itemList: "",
    planChangeDate: new Date(),
    planDate: new Date(),
    planNumber: 0,
    viewObject: "",
    viewProcedure: "",
    quarterDistribution: [],
  };

  const form = useForm<ProcurementFormInput, unknown, ProcurementFormOutput>({
    defaultValues,
    mode: "onChange",
    resolver: zodResolver(procurementSchema),
  });

  const onSubmit = (data: ProcurementFormOutput) => {
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
          <Button form="procurement-form" type="submit">
            Сохранить
          </Button>
        </div>
      </div>

      <div className="mt-4 mb-10">
        <FormProvider {...form}>
          <FormProcurement submitted={submitted} onSubmit={onSubmit} />
        </FormProvider>
      </div>
    </div>
  );
};

export const Component = ProcurementNewPage;
