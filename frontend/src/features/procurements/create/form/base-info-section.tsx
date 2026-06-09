import type { BaseInfoValues } from "../schema";

import { PlusIcon } from "lucide-react";
import { Controller, useFormContext } from "react-hook-form";

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

const departments = [
  {
    id: "1",
    // value: "Отдел 1",
    label: "Отдел 1",
  },
  {
    id: "2",
    // value: "Отдел 2",
    label: "Отдел 2",
  },
  {
    id: "3",
    // value: "Отдел 3",
    label: "Отдел 3",
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
  // const { append, fields, remove } = useFieldArray({
  //   control,
  //   name: `procurementItems[${fields.length}]`,
  // });

  // const handleAddItem = () => {
  //   append({
  //     id: "",

  //     planPointNumber: "",
  //     okrbCode: "",
  //     okrbName: "",
  //     goodsName: "",
  //     quantity: "",
  //     unit: "",
  //     department: "",
  //   });
  // };

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
          <CardContent className="flex gap-10 px-0">
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
            // onClick={() => handleAddItem()}
            className="text-accent-foreground hover:text-accent-foreground/50 cursor-pointer"
            size={20}></PlusIcon>
        </CardHeader>
        {/* {fields.length > 0 && <Separator />}
        <CardContent className="space-y-4 px-2">
          {fields.map((item) => {
            return (
              <FieldGroup className="flex flex-col" key={item.id}>
                <p>{item.id}</p>
                <FieldGroup className="grid grid-cols-2 gap-4">
                  <InputField
                    control={control}
                    name="articleNumber"
                    label="Статья"
                    placeholder="10"
                    type="text"
                    required
                  />
                  <InputField
                    control={control}
                    name="pstNumber"
                    label="ПСТ"
                    placeholder="10"
                    type="number"
                    required
                  />
                  <InputField
                    control={control}
                    name="elNumber"
                    label="ЭЛ"
                    placeholder="99"
                    type="number"
                    required
                  />
                  <InputField
                    control={control}
                    name="economicClass"
                    label="ЭКР"
                    placeholder="173"
                    type="number"
                    required
                  />

                  <InputField
                    control={control}
                    name="subElementNumber"
                    label="Под. элемент"
                    placeholder="1101008"
                    type="number"
                    required
                  />
                  <InputField
                    control={control}
                    name="elementNumber"
                    label="Элемент"
                    placeholder="1101000"
                    type="number"
                    required
                  />
                </FieldGroup>
                <TextAreaField
                  control={control}
                  name="expenseCategory"
                  label="Категория расходов"
                  placeholder="приобретение, сопровождение и информационное обеспечение программных средств для ЭКСПЕРТНЫХ подразделений"
                  required
                />
                <FieldGroup className="flex-row gap-4">
                  <ComboboxField
                    control={control}
                    name="departmentId"
                    items={departments}
                    label="Подразделение"
                    placeholder="Выберите подразделение"
                    renderItemValue={(item) => item.label}
                  />
                  <InputField
                    control={control}
                    name="allVolume"
                    label="Количество"
                    placeholder="100"
                    required
                  />
                  <InputField
                    control={control}
                    name="allVolume"
                    label="Сумма "
                    placeholder="100"
                    required
                  />
                </FieldGroup>
              </FieldGroup>
            );
          })}
        </CardContent> */}
      </Card>
    </div>
  );
};
