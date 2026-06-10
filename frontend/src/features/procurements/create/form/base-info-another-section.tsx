import type { AdditionalInfoValues, BaseInfoValues } from "../schema";

import { ChevronRightIcon } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";

import { InputField } from "@/shared/ui/form/input-field";
import { TextAreaField } from "@/shared/ui/form/text-area-field";
import { Button } from "@/shared/ui/kit/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/shared/ui/kit/collapsible";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/shared/ui/kit/combobox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/shared/ui/kit/field";

type Department = {
  id: number;
  name: string;
  shortName: string;
  active: boolean;
  parentId: number | null;
};

type DepartmentNode = Department & {
  children: DepartmentNode[];
};

const departments: Department[] = [
  {
    id: 1,
    name: "Управление режимно-секретной деятельностью и делопроизводства",
    shortName: "УРСИД",
    active: true,
    parentId: null,
  },
  {
    id: 2,
    name: "Управление кадровой деятельности",
    shortName: "УКД",
    active: true,
    parentId: null,
  },
  {
    id: 3,
    name: "Управление секретной политики сотрудников",
    shortName: "УСПС",
    active: true,
    parentId: null,
  },
  {
    id: 4,
    name: "Управление документацией и режимно-секретной",
    shortName: "УДРС",
    active: true,
    parentId: 1,
  },
  {
    id: 5,
    name: "Царское администрирование и режимно-секретная деятельность",
    shortName: "ЦАРС",
    active: true,
    parentId: 2,
  },
  {
    id: 6,
    name: "Секретное администрирование режимно-секретной деятельности",
    shortName: "САРС",
    active: true,
    parentId: 2,
  },
  {
    id: 7,
    name: "Маршрутное администрирование режимно-секретной деятельности",
    shortName: "МАРС",
    active: true,
    parentId: 1,
  },
];

export const BaseInfoAnotherSection = ({
  item,
  index,
}: {
  item: AdditionalInfoValues;
  index: number;
}) => {
  const { control } = useFormContext<BaseInfoValues>();

  function buildTree(
    items: Department[],
    parentId: number | null = null,
  ): DepartmentNode[] {
    return items
      .filter((item) => item.parentId === parentId)
      .map((item) => ({
        ...item,
        children: buildTree(items, item.id),
      }));
  }

  const departmentsByParentId = buildTree(departments);
  const childrenMap = departments.reduce<Record<number, typeof departments>>(
    (obj, item) => {
      if (item.parentId !== null) {
        (obj[item.parentId] ??= []).push(item);
      }
      return obj;
    },
    {},
  );

  // const departmentsByParentId = departments
  //   .filter((item) => item.parentId === null)
  //   .map((item) => {
  //     return { ...item, children: childrenMap[item.id] ?? [] };
  //   });

  const renderItem = (item: DepartmentNode): React.ReactNode => {
    if (item?.children?.length > 0) {
      return (
        <Collapsible key={item.id}>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="group hover:bg-accent hover:text-accent-foreground w-full justify-start transition-none">
              {item.shortName}
              <ChevronRightIcon className="transition-transform group-data-[state=open]:rotate-90" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="style-lyra:ml-4 mt-1 ml-5">
            <div className="flex flex-col gap-1">
              {item.children.map((child) => renderItem(child))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      );
    }
    return (
      <ComboboxItem key={item.id} value={item} className="px-3">
        {item.shortName}
      </ComboboxItem>
    );
  };

  return (
    <FieldGroup className="flex flex-col">
      <p>{index + 1}</p>
      <FieldGroup className="grid grid-cols-2 gap-4">
        <InputField
          control={control}
          name={`procurementItems.${index}.articleNumber`}
          label="Статья"
          placeholder="10"
          type="text"
          required
        />
        <InputField
          control={control}
          name={`procurementItems.${index}.pstNumber`}
          label="ПСТ"
          placeholder="10"
          type="number"
          required
        />
        <InputField
          control={control}
          name={`procurementItems.${index}.elNumber`}
          label="ЭЛ"
          placeholder="99"
          type="number"
          required
        />
        <InputField
          control={control}
          name={`procurementItems.${index}.economicClass`}
          label="ЭКР"
          placeholder="173"
          type="number"
          required
        />

        <InputField
          control={control}
          name={`procurementItems.${index}.subElementNumber`}
          label="Под. элемент"
          placeholder="1101008"
          type="number"
          required
        />
        <InputField
          control={control}
          name={`procurementItems.${index}.elementNumber`}
          label="Элемент"
          placeholder="1101000"
          type="number"
          required
        />
      </FieldGroup>
      <TextAreaField
        control={control}
        name={`procurementItems.${index}.expenseCategory`}
        label="Категория расходов"
        placeholder="приобретение, сопровождение и информационное обеспечение программных средств для ЭКСПЕРТНЫХ подразделений"
        required
      />
      <FieldGroup className="flex-row gap-4">
        {/* <ComboboxField
          control={control}
          name={`procurementItems.${index}.departmentId`}
          items={options}
          label="Подразделение"
          placeholder="Выберите подразделение"
          renderItemValue={(item) => item.label}
        /> */}

        <Controller
          control={control}
          name={`procurementItems.${index}.departmentId`}
          render={({ field, fieldState }) => {
            console.log(field.value);
            return (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Подразделение</FieldLabel>
                <Combobox
                  items={departmentsByParentId}
                  value={
                    departments.find(
                      (item) => item.id === Number(field.value),
                    ) ?? null
                  }
                  itemToStringLabel={(item) =>
                    item !== null ? item.shortName : ""
                  }
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
                      {(item: DepartmentNode) => {
                        return renderItem(item);
                      }}
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
          name={`procurementItems.${index}.volume`}
          label="Количество"
          placeholder="100"
          required
        />
        <InputField
          control={control}
          name={`procurementItems.${index}.cost`}
          label="Сумма "
          placeholder="100"
          required
        />
      </FieldGroup>
    </FieldGroup>
  );
};
