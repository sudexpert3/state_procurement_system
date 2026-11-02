import type { Department } from "@/shared/api/schema";
import type { BaseInfoValues } from "../schema";

import { ChevronRightIcon } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";

import { rqClient } from "@/shared/api/instance";
import { InputField } from "@/shared/components/form/input-field";
import { TextAreaField } from "@/shared/components/form/text-area-field";
import { Button } from "@/shared/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/components/ui/collapsible";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/shared/components/ui/combobox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/shared/components/ui/field";

type DepartmentNode = Department & {
  sub_departments: DepartmentNode[];
};

export const BaseInfoAnotherSection = ({
  index,
  remove,
}: {
  index: number;
  remove: (index?: number | number[]) => void;
}) => {
  const { control } = useFormContext<BaseInfoValues>();

  const getDepartments = rqClient.useQuery(
    "get",
    "/api/departments/",
    {
      params: {
        query: {
          tree: true,
        } as
          | {
              is_active?: boolean;
              parent?: number;
              search?: string;
              tree?: boolean;
            }
          | undefined,
      },
    },
    {
      select: (data) => {
        return data as DepartmentNode[];
      },
    },
  );

  const renderItem = (
    item: DepartmentNode,
    index?: number,
  ): React.ReactNode => {
    if (item?.sub_departments?.length > 0) {
      return (
        <Collapsible key={item.id + `${index}`}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="group hover:bg-accent hover:text-accent-foreground w-full justify-start transition-none">
              {item.short_name}
              <ChevronRightIcon className="transition-transform group-data-[state=open]:rotate-90" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="style-lyra:ml-4 mt-1 ml-5">
            <div className="flex flex-col gap-1">
              {item.sub_departments.map((child) => renderItem(child))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      );
    }
    return (
      <ComboboxItem key={item.id + `${index}`} value={item} className="px-3">
        {item.short_name}
      </ComboboxItem>
    );
  };

  return (
    <FieldGroup className="flex flex-col">
      <p>{index + 1}</p>
      <FieldGroup className="grid grid-cols-2 gap-4">
        <InputField
          control={control}
          name={`planItems.${index}.articleNumber`}
          label="Статья"
          placeholder="10"
          type="text"
          required
        />
        <InputField
          control={control}
          name={`planItems.${index}.pstNumber`}
          label="ПСТ"
          placeholder="10"
          type="number"
          required
        />
        <InputField
          control={control}
          name={`planItems.${index}.elNumber`}
          label="ЭЛ"
          placeholder="99"
          type="number"
          required
        />
        <InputField
          control={control}
          name={`planItems.${index}.economicClass`}
          label="ЭКР"
          placeholder="173"
          type="number"
          required
        />

        <InputField
          control={control}
          name={`planItems.${index}.subElementNumber`}
          label="Под. элемент"
          placeholder="1101008"
          type="number"
          required
        />
        <InputField
          control={control}
          name={`planItems.${index}.elementNumber`}
          label="Элемент"
          placeholder="1101000"
          type="number"
          required
        />
      </FieldGroup>
      <TextAreaField
        control={control}
        name={`planItems.${index}.expenseCategory`}
        label="Категория расходов"
        placeholder="приобретение, сопровождение и информационное обеспечение программных средств для ЭКСПЕРТНЫХ подразделений"
        required
      />
      <FieldGroup className="flex-row gap-4">
        {/* <ComboboxField
          control={control}
          name={`planItems.${index}.departmentId`}
          items={options}
          label="Подразделение"
          placeholder="Выберите подразделение"
          renderItemValue={(item) => item.label}
        /> */}

        <Controller
          control={control}
          name={`planItems.${index}.departmentId`}
          render={({ field, fieldState }) => {
            return (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Подразделение</FieldLabel>
                <Combobox
                  itemToStringLabel={(item: Department) => {
                    return item ? item.short_name : "";
                  }}
                  onValueChange={(item) => field.onChange(item?.id ?? null)}
                  autoHighlight>
                  <ComboboxTrigger
                    render={
                      <Button
                        variant="outline"
                        className="w-64 justify-between font-normal">
                        <ComboboxValue placeholder="Выберите подразделение" />
                      </Button>
                    }
                  />
                  <ComboboxContent>
                    <ComboboxInput showTrigger={false} placeholder="Search" />
                    <ComboboxEmpty>Подразделение не найдено</ComboboxEmpty>
                    <ComboboxList>
                      {getDepartments.data?.map(
                        (item: DepartmentNode, index) => {
                          return renderItem(item, index);
                        },
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                {fieldState.invalid && (
                  <FieldError>{fieldState.error?.message}</FieldError>
                )}
              </Field>
            );
          }}
        />
        <InputField
          control={control}
          name={`planItems.${index}.volume`}
          label="Количество"
          placeholder="100"
          required
        />
        <InputField
          control={control}
          name={`planItems.${index}.cost`}
          label="Сумма "
          placeholder="100"
          required
        />
      </FieldGroup>
      <Button variant="destructive" onClick={() => remove(index)}>
        Удалить
      </Button>
    </FieldGroup>
  );
};
