import { useState } from "react";

import {
  CHANGE_REQUEST_STATUS_LABELS,
  ChangeRequestActions,
  useChangeRequestsQuery,
} from "@/services/change-requests";
import { SectionCard } from "@/shared/components/section-card";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

import {
  type CalibrationContext,
  DepartmentArticleLimitsEditor,
} from "./department-article-limits-editor";
import { StartCalibrationForm } from "./start-calibration-form";

const LimitCalibrationPage = () => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [context, setContext] = useState<CalibrationContext | null>(null);

  const { data } = useChangeRequestsQuery({
    kind: "DEPARTMENT_LIMIT_CALIBRATION",
    limit: 50,
    offset: 0,
  });

  const selected = data?.results.find((item) => item.id === selectedId);

  const handleSelect = (
    id: number,
    row: { functional_class?: number; economic_class?: number; year?: number },
  ) => {
    setSelectedId(id);
    if (row.functional_class && row.economic_class && row.year) {
      setContext({
        functional_class: row.functional_class,
        economic_class: row.economic_class,
        year: row.year,
      });
    }
  };

  return (
    <Card className="max-w-full gap-2 bg-transparent ring-0">
      <CardHeader>
        <CardTitle>Корректировка лимитов</CardTitle>
        <CardDescription>
          Разбивка укрупнённых статей Минфина на подстатьи и держателей лимита
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <SectionCard title="Начать новую калибровку">
          <div className="px-2 py-4">
            <StartCalibrationForm
              onCreated={(id, ctx) => {
                setSelectedId(id);
                setContext(ctx);
              }}
            />
          </div>
        </SectionCard>

        <SectionCard title="Существующие калибровки">
          <div className="flex flex-col gap-2 px-2 py-4">
            {data?.results.length ? (
              data.results.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between">
                  <span className="text-sm">
                    №{item.id} — {CHANGE_REQUEST_STATUS_LABELS[item.status]}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSelect(item.id, {})}>
                    Открыть
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">
                Калибровок пока не было
              </p>
            )}
          </div>
        </SectionCard>

        {selected && (
          <SectionCard title={`Калибровка №${selected.id}`}>
            <div className="flex flex-col gap-4 px-2 py-4">
              {selected.status === "DRAFT" && context && (
                <DepartmentArticleLimitsEditor
                  changeRequestId={selected.id}
                  context={context}
                />
              )}
              {selected.status === "DRAFT" && !context && (
                <p className="text-muted-foreground text-sm">
                  Контекст статьи для этого черновика не загружен — откройте его
                  сразу после создания или начните калибровку заново.
                </p>
              )}
              <ChangeRequestActions item={selected} />
            </div>
          </SectionCard>
        )}
      </CardContent>
    </Card>
  );
};

export const Component = LimitCalibrationPage;
