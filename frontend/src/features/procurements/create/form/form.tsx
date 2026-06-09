import type { ProcurementFormInput, ProcurementFormOutput } from "../schema";

import { useFormContext } from "react-hook-form";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/kit/card";

import { FormTabsNavigation } from "./form-tabs-navigation";

export const FormProcurement = ({
  submitted,
  onSubmit,
}: {
  submitted: ProcurementFormInput | null;
  onSubmit: (data: ProcurementFormOutput) => void;
}) => {
  const form = useFormContext<ProcurementFormOutput>();

  return (
    <>
      <form
        id="procurement-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
        noValidate>
        <FormTabsNavigation />
      </form>

      {submitted && (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs text-green-600 dark:bg-green-900 dark:text-green-300">
                ✓
              </span>
              Позиция успешно сохранена
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              {Object.entries(submitted).map(([k, v]) => (
                <div key={k} className="space-y-0.5">
                  <p className="text-muted-foreground text-xs tracking-wide uppercase">
                    {k}
                  </p>
                  <p className="text-foreground font-medium">
                    {JSON.stringify(v)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
};
