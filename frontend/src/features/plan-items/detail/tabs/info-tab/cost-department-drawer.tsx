import type {
  ApiSchemas,
  CostDepartment,
  Department,
} from "@/shared/api/schema";

import { useMemo, useRef } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { rqClient } from "@/shared/api/instance";
import { InputField } from "@/shared/components/form/input-field";
import { Button } from "@/shared/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/shared/components/ui/combobox";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { Field, FieldError, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import { formatByn } from "@/shared/lib/helpers/format-money";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";

import {
  type CostDepartmentFormInput,
  type CostDepartmentFormValues,
  costDepartmentSchema,
} from "./cost-department.schema";

type Props = {
  open: boolean;
  /** Редактируемая запись — null для создания нового распределения */
  item: CostDepartment | null;
  /** ID записи BudgetCosts (года финансирования), к которой привязано распределение */
  budgetCostId: number | null;
  excludedDepartmentIds: number[];
  onClose: () => void;
  onSuccess: () => void;
};

const defaultValues: CostDepartmentFormInput = {
  department_id: 0,
  shared_amount: 0,
  shared_cost: 0,
  shared_inner_cost: 0,
  shared_fund_cost: 0,
};

const flattenTree = (nodes: Department[]): Department[] =>
  nodes.flatMap((node) => [node, ...flattenTree(node.sub_departments)]);

export const CostDepartmentDrawer = ({
  open,
  item,
  budgetCostId,
  excludedDepartmentIds,
  onClose,
  onSuccess,
}: Props) => {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const isEdit = item !== null;

  const departmentsQuery = rqClient.useQuery("get", "/api/departments/", {
    params: { query: { is_active: true } },
  });

  // TODO: убрать приведение после исправления sub_departments в OpenAPI.
  const departments = useMemo(
    () =>
      flattenTree(
        (departmentsQuery.data ?? []) as unknown as Department[],
      ).filter((department) => !excludedDepartmentIds.includes(department.id)),
    [departmentsQuery.data, excludedDepartmentIds],
  );

  const createMutation = rqClient.useMutation("post", "/api/plan_shares/");
  const updateMutation = rqClient.useMutation(
    "patch",
    "/api/plan_shares/{id}/",
  );
  const isPending = createMutation.isPending || updateMutation.isPending;

  const formValues: CostDepartmentFormInput = item
    ? {
        department_id: item.department_detail.id,
        shared_amount: Number(item.shared_amount),
        shared_cost: Number(item.shared_cost),
        shared_inner_cost: Number(item.shared_inner_cost),
        shared_fund_cost: Number(item.shared_fund_cost),
      }
    : defaultValues;

  const { control, handleSubmit } = useForm<
    CostDepartmentFormInput,
    unknown,
    CostDepartmentFormValues
  >({
    resolver: zodResolver(costDepartmentSchema),
    values: formValues,
  });

  const [sharedCost, sharedInnerCost, sharedFundCost] = useWatch({
    control,
    name: ["shared_cost", "shared_inner_cost", "shared_fund_cost"],
  });
  const totalCost =
    Number(sharedCost || 0) +
    Number(sharedInnerCost || 0) +
    Number(sharedFundCost || 0);

  const handleSuccess = (message: string) => {
    toast.success(message);
    onClose();
    onSuccess();
  };

  const submit = handleSubmit((values) => {
    const body = {
      department: values.department_id,
      shared_amount: String(values.shared_amount),
      shared_cost: String(values.shared_cost),
      shared_inner_cost: String(values.shared_inner_cost),
      shared_fund_cost: String(values.shared_fund_cost),
    };

    if (item) {
      updateMutation.mutate(
        { params: { path: { id: item.id } }, body },
        {
          onSuccess: () => handleSuccess("Распределение обновлено"),
          onError: (error) =>
            handleHttpError(error, "Не удалось сохранить распределение", true),
        },
      );
    } else {
      createMutation.mutate(
        {
          // Базовый ModelViewSet.create() переиспользует полный PlanShareSerializer
          // (readonly `id` в сгенерированной схеме обязателен для записи, хотя
          // DRF игнорирует его на вход) — тот же приём, что и в
          // services/change-requests/api.ts (useCreateChangeRequest).
          body: {
            ...body,
            budget_cost: budgetCostId ?? 0,
          } as unknown as ApiSchemas["PlanShare"],
        },
        {
          onSuccess: () => handleSuccess("Подразделение добавлено"),
          onError: (error) =>
            handleHttpError(error, "Не удалось добавить подразделение", true),
        },
      );
    }
  });

  return (
    <Drawer
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && onClose()}
      direction="right">
      <DrawerContent className="flex flex-col" ref={portalContainerRef}>
        <DrawerHeader>
          <DrawerTitle>
            {isEdit ? "Изменить подразделение" : "Добавить подразделение"}
          </DrawerTitle>
        </DrawerHeader>

        <form
          id="cost-department-form"
          onSubmit={(event) => {
            event.stopPropagation();
            void submit(event);
          }}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
          <Controller
            name="department_id"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Наименование подразделения</FieldLabel>
                <Combobox
                  items={departments}
                  value={
                    departments.find(
                      (department) => department.id === field.value,
                    ) ?? null
                  }
                  onValueChange={(department: Department | null) =>
                    field.onChange(department?.id ?? 0)
                  }
                  itemToStringLabel={(department) =>
                    department?.short_name ?? ""
                  }
                  itemToStringValue={(department) =>
                    department ? String(department.id) : ""
                  }
                  autoHighlight>
                  <ComboboxInput
                    placeholder="Поиск по наименованию..."
                    disabled={departmentsQuery.isLoading}
                    showClear
                    aria-invalid={fieldState.invalid}
                  />
                  <ComboboxContent portalContainer={portalContainerRef}>
                    <ComboboxEmpty>
                      {departmentsQuery.isLoading
                        ? "Загрузка..."
                        : "Подразделение не найдено"}
                    </ComboboxEmpty>
                    <ComboboxList>
                      {(department: Department) => (
                        <ComboboxItem key={department.id} value={department}>
                          {department.short_name}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <InputField
            control={control}
            name="shared_amount"
            label="Количество"
            placeholder="0"
            type="number"
            min={0}
            step="any"
            required
          />
          <InputField
            control={control}
            name="shared_cost"
            label="Сумма со счетов казначейства, BYN"
            placeholder="0.00"
            type="number"
            min={0}
            step="0.01"
            required
          />
          <InputField
            control={control}
            name="shared_inner_cost"
            label="Собственные средства, BYN"
            placeholder="0.00"
            type="number"
            min={0}
            step="0.01"
            required
          />
          <InputField
            control={control}
            name="shared_fund_cost"
            label="Оплата со счетов заказчика, BYN"
            placeholder="0.00"
            type="number"
            min={0}
            step="0.01"
            required
          />
          <Field>
            <FieldLabel>Общая сумма, BYN</FieldLabel>
            <Input value={formatByn(totalCost)} disabled readOnly />
          </Field>
        </form>

        <DrawerFooter>
          <Button
            type="submit"
            form="cost-department-form"
            disabled={isPending}>
            {isPending && <Loader2Icon size={16} className="animate-spin" />}
            {isEdit ? "Сохранить" : "Добавить"}
          </Button>
          <DrawerClose asChild>
            <Button type="button" variant="outline">
              Отмена
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
