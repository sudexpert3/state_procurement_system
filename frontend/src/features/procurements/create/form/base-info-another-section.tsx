import type { AdditionalInfoValues, BaseInfoValues } from "../schema";

import { ChevronRightIcon, FolderIcon } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { InputField } from "@/shared/ui/form/input-field";
import { TextAreaField } from "@/shared/ui/form/text-area-field";
import { Button } from "@/shared/ui/kit/button";
import {
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/shared/ui/kit/collapsible";
import { FieldGroup } from "@/shared/ui/kit/field";

const departments = [
  {
    id: 1,
    name: "Управление режимно-секретной деятельностью и делопроизводства",
    shortName: "УРСДиД",
    active: true,
    parentId: null,
  },
  {
    id: 2,
    name: "Управление режимно-секретной деятельностью и делопроизводства",
    shortName: "УРСДиД",
    active: true,
    parentId: null,
  },
  {
    id: 3,
    name: "Управление режимно-секретной деятельностью и делопроизводства",
    shortName: "УРСДиД",
    active: true,
    parentId: null,
  },
  {
    id: 4,
    name: "Управление режимно-секретной деятельностью и делопроизводства",
    shortName: "УРСДиД",
    active: true,
    parentId: null,
  },
  {
    id: 5,
    name: "Управление режимно-секретной деятельностью и делопроизводства",
    shortName: "УРСДиД",
    active: true,
    parentId: null,
  },
  {
    id: 6,
    name: "Управление режимно-секретной деятельностью и делопроизводства",
    shortName: "УРСДиД",
    active: true,
    parentId: null,
  },
  {
    id: 7,
    name: "Управление режимно-секретной деятельностью и делопроизводства",
    shortName: "УРСДиД",
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
  const childrenMap = departments.reduce<Record<number, typeof departments>>(
    (obj, item) => {
      if (item.parentId !== null) {
        (obj[item.parentId] ??= []).push(item);
      }
      return obj;
    },
    {},
  );

  const departmentsByParentId = departments
    .filter((item) => item.parentId === null)
    .map((item) => ({
      ...item,
      children: childrenMap[item.id] ?? [],
    }));

  const renderItem = (item: (typeof departmentsByParentId)[number]) => {
    if ("children" in item) {
      return (
        <>
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="group hover:bg-accent hover:text-accent-foreground w-full justify-start transition-none">
              <ChevronRightIcon className="transition-transform group-data-[state=open]:rotate-90" />
              <FolderIcon />
              {item.shortName}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="style-lyra:ml-4 mt-1 ml-5">
            <div className="flex flex-col gap-1">
              {item.children.map((child) => renderItem(child))}
            </div>
          </CollapsibleContent>
        </>
      );
    }
    return;
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
          items={departments}
          label="Подразделение"
          placeholder="Выберите подразделение"
          renderItemValue={(item) => item.}
        /> */}

        {/* <Controller
          control={control}
          name={`procurementItems.${index}.departmentId`}
          render={({ field }) => {
            return (
              <Collapsible>
                {departmentsByParentId.map((item) => {
                  return (
                    <>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="group hover:bg-accent hover:text-accent-foreground w-full justify-start transition-none">
                          <ChevronRightIcon className="transition-transform group-data-[state=open]:rotate-90" />
                          <FolderIcon />
                          {item.shortName}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="style-lyra:ml-4 mt-1 ml-5">
                        <div className="flex flex-col gap-1">
                          {item.children.map((child) => renderItem(child))}
                        </div>
                      </CollapsibleContent>
                    </>
                  );
                })}
              </Collapsible>
            );
          }}
        /> */}
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
