import type { PlanningInfoValues } from "../schema";

import { useFormContext } from "react-hook-form";

import { ComboboxField } from "@/shared/ui/form/combobox-field";
import { DatePickerField } from "@/shared/ui/form/date-picker-field";
import { InputField } from "@/shared/ui/form/input-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/kit/card";
import { FieldGroup } from "@/shared/ui/kit/field";
import { Separator } from "@/shared/ui/kit/separator";

const viewObjectsMock = [
  { id: "1", value: "Объект 1", disabled: true },
  { id: "2", value: "Объект 2", disabled: true },
  { id: "3", value: "Объект 3", disabled: true },
];

const itemsListMock = [
  { id: "1", value: "Пункт 1", disabled: true },
  { id: "2", value: "Пункт 2", disabled: true },
  { id: "3", value: "Пункт 3", disabled: true },
];

export const PlanningSection = () => {
  const { control } = useFormContext<PlanningInfoValues>();

  return (
    <div className="flex w-full gap-10 pb-4">
      <Card className="w-full ring-0">
        <CardHeader className="px-2">
          <CardTitle className="text-lg font-semibold tracking-wide uppercase">
            График поставки
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="justify-start px-2">
          <FieldGroup className="flex-row items-center">
            <DatePickerField
              control={control}
              label="Дата плана"
              name="planDate"
              placeholder="Выберите дату"
            />
            <DatePickerField
              control={control}
              label="Дата изменения плана"
              name="planChangeDate"
              placeholder="Выберите дату"
            />
            {/* <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold">Осталось дней</label>
              <div className="bg-chart-1/50 rounded-2xl p-2 text-center">
                <p className="text-sm font-semibold">0 дней</p>
              </div>
            </div> */}
          </FieldGroup>
        </CardContent>
      </Card>
      <Card className="w-full ring-0">
        <CardHeader className="px-2">
          <CardTitle className="text-lg font-semibold tracking-wide uppercase">
            Детали плана
          </CardTitle>
        </CardHeader>
        <Separator />
        <CardContent className="space-y-4 px-2">
          <InputField
            control={control}
            name="planNumber"
            label="№ плана публикации"
            placeholder="52311"
          />
          <ComboboxField
            control={control}
            name="itemList"
            items={itemsListMock}
            label="Пункт перечня"
            placeholder="Пункт перечня"
            renderItemValue={(item) => item.value}
          />
          <ComboboxField
            control={control}
            name="viewObject"
            items={viewObjectsMock}
            label="Вид объекта"
            placeholder="Выберите вид объекта"
            renderItemValue={(item) => item.value}
          />
          <ComboboxField
            control={control}
            name="viewProcedure"
            label="Вид процедуры"
            items={viewObjectsMock}
            placeholder="Выберите вид процедуры"
            renderItemValue={(item) => item.value}
          />
        </CardContent>
      </Card>
    </div>
  );
};
