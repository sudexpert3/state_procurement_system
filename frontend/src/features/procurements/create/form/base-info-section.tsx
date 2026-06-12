import type { BaseInfoValues } from "../schema";

import { PlusIcon } from "lucide-react";
import { Controller, useFieldArray, useFormContext } from "react-hook-form";

import { ComboboxField } from "@/shared/ui/form/combobox-field";
import { InputField } from "@/shared/ui/form/input-field";
import { TextAreaField } from "@/shared/ui/form/text-area-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/kit/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/shared/ui/kit/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/kit/select";
import { Separator } from "@/shared/ui/kit/separator";

import { BaseInfoAnotherSection } from "./base-info-another-section";

const codesOkrb = [
  {
    id: "1",
    value: "61.10.11.000",
    label: "61.10.11.000",
  },
  {
    id: "2",
    value: "61.11.12.000",
    label: "61.11.12.000",
  },
  {
    id: "3",
    value: "61.12.13.000",
    label: "61.12.13.000",
  },
];

const units = [
  {
    id: "1",
    value: "шт",
    label: "шт",
  },
  {
    id: "2",
    value: "кг",
    label: "кг",
  },
  {
    id: "3",
    value: "м",
    label: "м",
  },
];
const customers = [
  {
    id: "1",
    // value: "Отдел 1",
    label: "Исполнитель 1",
  },
  {
    id: "2",
    // value: "Отдел 2",
    label: "Исполнитель 2",
  },
  {
    id: "3",
    // value: "Отдел 3",
    label: "Исполнитель 3",
  },
];

export const BaseInfoSection = () => {
  const { control } = useFormContext<BaseInfoValues>();
  const { append, fields, remove } = useFieldArray({
    control,
    name: `procurementItems`,
  });

  const handleAddItem = () => {
    append({
      articleNumber: 0,
      cost: 0,
      volume: 0,
      subElementNumber: 0,
      elementNumber: 0,
      pstNumber: 0,
      expenseCategory: "",
      elNumber: 0,
      economicClass: 0,
      departmentId: "",
    });
  };

  return (
    <div className="w-full">
      <div className="flex gap-10">
        <Card className="w-full ring-0">
          <CardHeader className="px-2">
            <CardTitle className="text-lg font-semibold tracking-wide uppercase">
              Предмет закупки
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="flex gap-10 px-2">
            <FieldGroup>
              <InputField
                control={control}
                name="planPointNumber"
                label="Номер пункта плана"
                placeholder="4.2"
                type="number"
                required
              />
              <FieldGroup className="flex-row">
                <ComboboxField
                  control={control}
                  name="okrbCode"
                  label="Код ОКРБ"
                  items={codesOkrb}
                  renderItemValue={(item) => item.value}
                  placeholder="Выберите код ОКРБ"
                  className="w-1/3"
                />
                <TextAreaField
                  control={control}
                  className=""
                  name="okrbName"
                  label="Наименование по ОКРБ"
                  placeholder="Справочное наименование по классификатору..."
                  required
                />
              </FieldGroup>
              <TextAreaField
                control={control}
                name="goodsName"
                label="Наименование предмета закупки"
                placeholder="Наименование предмета закупки..."
                required
              />
            </FieldGroup>
            <FieldGroup>
              <Controller
                control={control}
                name="typeOfGoodsId"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel>Тип работа/услуга/товар</FieldLabel>
                    <Select
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}>
                      <SelectTrigger
                        id="rhf-select-typeOfGoods"
                        aria-invalid={fieldState.invalid}>
                        <SelectValue placeholder="Выберите тип" />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        <SelectGroup>
                          <SelectItem value="work">Работа/Услуга</SelectItem>
                          <SelectItem value="product">Товар</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
              <ComboboxField
                control={control}
                name="customerId"
                items={customers}
                placeholder="Выберите исполнителя"
                label="Исполнитель"
                renderItemValue={(item) => item.label}
              />
              <FieldGroup className="flex-row gap-4">
                <InputField
                  control={control}
                  name="allVolume"
                  label="Общее количество"
                  placeholder="100"
                  required
                />
                <ComboboxField
                  control={control}
                  name="units"
                  label="Ед. измерения"
                  items={units}
                  renderItemValue={(item) => item.value}
                  placeholder="Выберите ед. измерения"
                />
              </FieldGroup>
              <InputField
                control={control}
                name="allVolume"
                label="Общая сумма"
                placeholder="100"
                required
              />
            </FieldGroup>
          </CardContent>
        </Card>
      </div>
      <Card className="w-full ring-0">
        <CardHeader className="flex items-center gap-3 px-2">
          <CardTitle className="text-lg font-semibold tracking-wide uppercase">
            Иная информация
          </CardTitle>
          <PlusIcon
            onClick={() => handleAddItem()}
            className="text-accent-foreground hover:text-accent-foreground/50 cursor-pointer"
            size={20}
          />
        </CardHeader>
        {fields.length > 0 && <Separator />}
        <CardContent className="space-y-4 px-2">
          {fields.map((item, index) => (
            <BaseInfoAnotherSection key={item.id} item={item} index={index} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
