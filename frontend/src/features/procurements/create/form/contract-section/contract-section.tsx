import type { ContractInfoValues } from "@/features/procurements/create/schema";

import { Controller, useFormContext } from "react-hook-form";

import { contractStatus } from "@/features/procurements/create/config";
import { ComboboxField } from "@/shared/ui/form/combobox-field";
import { DatePickerField } from "@/shared/ui/form/date-picker-field";
import { InputField } from "@/shared/ui/form/input-field";
import { TextAreaField } from "@/shared/ui/form/text-area-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/kit/card";
import { Field, FieldError, FieldLabel } from "@/shared/ui/kit/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/kit/select";
import { Separator } from "@/shared/ui/kit/separator";

import { EditableTable } from "./editable-table";

const suppliersMock = [
  { id: "1", value: "Поставщик 1", disabled: true },
  { id: "2", value: "Поставщик 2", disabled: true },
  { id: "3", value: "Поставщик 3", disabled: true },
];

export const ContractSection = () => {
  const { control } = useFormContext<ContractInfoValues>();
  return (
    <div className="w-full pb-4">
      <div className="flex gap-10">
        <Card className="w-full ring-0">
          <CardHeader className="px-2">
            <CardTitle className="text-lg font-semibold tracking-wide uppercase">
              Детали договора
            </CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="space-y-4 px-2">
            <InputField
              control={control}
              name="contractNumber"
              label="№ договора"
              placeholder="52311"
              required
            />
            <DatePickerField
              control={control}
              label="Дата договора"
              name="contractDate"
              placeholder="Выберите дату"
            />
            <ComboboxField
              control={control}
              name="supplierId"
              label="Поставщик"
              items={suppliersMock}
              placeholder="Выберите поставщика"
              renderItemValue={(item) => item.value}
            />
            <TextAreaField
              control={control}
              name="contractTerms"
              label="Условия оплаты/поставки"
              placeholder="условия договора"
            />
            <TextAreaField
              control={control}
              name="contractNotes"
              label="Примечания по договору"
              placeholder="Примечания по договору"
            />
            <Controller
              control={control}
              name="contractStatus"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel>Статус договора</FieldLabel>
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
                        <SelectItem value={contractStatus.ACCEPTED}>
                          Принято к оплате ТК
                        </SelectItem>
                        <SelectItem value={contractStatus.CANCELLED}>
                          Не принято к оплате ТК
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </CardContent>
        </Card>
        <div className="w-full">
          <Card className="w-full ring-0">
            <CardHeader className="px-2">
              <CardTitle className="text-lg font-semibold tracking-wide uppercase">
                Объемы финансирования
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-4 px-2">
              <InputField
                control={control}
                name="currentPlanBalance"
                label="Текущая сумма плана (BYN)"
                placeholder="0.00"
                type="number"
                required
              />
              <InputField
                control={control}
                name="contractSum"
                label="Сумма договора (BYN)" //!Сумма договора не должна превышать сумму плана
                placeholder="0.00"
                type="number"
                required
              />
            </CardContent>
          </Card>
          <Card className="w-full ring-0">
            <CardHeader className="px-2">
              <CardTitle className="text-lg font-semibold tracking-wide uppercase">
                Контроль исполнения
              </CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-4 px-2">
              <InputField
                control={control}
                name="totalLiabilities"
                label="Сумма принятых обязательств"
                placeholder="0.00"
                type="number"
                required
              />
              <InputField
                control={control}
                name="variance"
                label="Отклонение (план/договор)"
                placeholder="0.00"
                disabled
              />
              <InputField
                control={control}
                name="remainingBalance"
                label="Остаток от договора"
                placeholder="0.00"
                disabled
              />
            </CardContent>
          </Card>
        </div>
      </div>
      <EditableTable />
    </div>
  );
};
