import type { Department } from "@/shared/api/schema";

import { useMemo, useRef } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, useWatch } from "react-hook-form";

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

import {
  type CostDepartmentFormInput,
  type CostDepartmentFormValues,
  costDepartmentSchema,
} from "./cost-department.schema";

type Props = {
  open: boolean;
  excludedDepartmentIds: number[];
  onClose: () => void;
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
  excludedDepartmentIds,
  onClose,
}: Props) => {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
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

  const { control, handleSubmit, reset } = useForm<
    CostDepartmentFormInput,
    unknown,
    CostDepartmentFormValues
  >({
    resolver: zodResolver(costDepartmentSchema),
    defaultValues,
  });

  const [sharedCost, sharedInnerCost, sharedFundCost] = useWatch({
    control,
    name: ["shared_cost", "shared_inner_cost", "shared_fund_cost"],
  });
  const totalCost =
    Number(sharedCost || 0) +
    Number(sharedInnerCost || 0) +
    Number(sharedFundCost || 0);

  const close = () => {
    reset(defaultValues);
    onClose();
  };

  const submit = handleSubmit(close);

  return (
    <Drawer
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && close()}
      direction="right">
      <DrawerContent className="flex flex-col" ref={portalContainerRef}>
        <DrawerHeader>
          <DrawerTitle>Добавить подразделение</DrawerTitle>
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
          <Button type="submit" form="cost-department-form">
            Добавить
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
