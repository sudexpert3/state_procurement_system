import type {
  BudgetLimitCorrectionLine,
  BudgetLimitCorrectionPreviewLine,
  BudgetLimitCorrectionPreviewReport,
} from "@/services/change-requests";

import { useMemo, useState } from "react";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import {
  useBudgetLimitCorrectionPreview,
  useCreateBudgetLimitCorrection,
} from "@/services/change-requests";
import { Button } from "@/shared/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/shared/components/ui/drawer";
import { Field, FieldLabel } from "@/shared/components/ui/field";
import { Input } from "@/shared/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Textarea } from "@/shared/components/ui/textarea";
import { formatByn } from "@/shared/lib/helpers/format-money";
import { handleHttpError } from "@/shared/lib/helpers/handle-http-error";
import { cn } from "@/shared/lib/utils";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;
type Quarter = (typeof QUARTERS)[number];
const QUARTER_COLUMN_LABELS: Record<Quarter, string> = {
  Q1: "I кв.",
  Q2: "II кв.",
  Q3: "III кв.",
  Q4: "IV кв.",
};

// Одна строка предпросмотра (`lines`) — это (статья × квартал). Пользователь
// попросил показывать статью ОДНОЙ строкой с кварталами в столбцах, поэтому
// группируем плоский список по статье (функц.+экон. код+год) — индексы в
// `lines` сохраняются в `byQuarter`, чтобы правка суммы по-прежнему била в
// исходный плоский массив, который и уходит на сохранение.
type LineGroup = {
  key: string;
  economicDetail: BudgetLimitCorrectionPreviewLine["economic_class_detail"];
  functionalDetail: BudgetLimitCorrectionPreviewLine["functional_class_detail"];
  byQuarter: Partial<Record<Quarter, number>>;
};

const groupLines = (lines: BudgetLimitCorrectionPreviewLine[]): LineGroup[] => {
  const groups = new Map<string, LineGroup>();

  lines.forEach((line, index) => {
    const key = `${line.functional_class}-${line.economic_class}-${line.year}`;
    const group = groups.get(key) ?? {
      key,
      economicDetail: line.economic_class_detail,
      functionalDetail: line.functional_class_detail,
      byQuarter: {},
    };
    group.byQuarter[line.quarter as Quarter] = index;
    groups.set(key, group);
  });

  return Array.from(groups.values());
};

type Props = {
  open: boolean;
  onClose: () => void;
};

export const BudgetLimitCorrectionImport = ({ open, onClose }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<BudgetLimitCorrectionPreviewLine[] | null>(
    null,
  );
  const [report, setReport] =
    useState<BudgetLimitCorrectionPreviewReport | null>(null);

  const { preview, isPending: isPreviewing } =
    useBudgetLimitCorrectionPreview();
  const { createBudgetLimitCorrection, isPending: isSaving } =
    useCreateBudgetLimitCorrection();

  const reset = () => {
    setFile(null);
    setYear(new Date().getFullYear());
    setReason("");
    setLines(null);
    setReport(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handlePreview = () => {
    if (!file) return;

    preview(
      { file, year },
      {
        onSuccess: (result) => {
          setLines(result.lines);
          setReport(result.report);
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось разобрать файл", true),
      },
    );
  };

  const updateAmount = (index: number, amount: string) =>
    setLines(
      (prev) =>
        prev?.map((line, i) => (i === index ? { ...line, amount } : line)) ??
        null,
    );

  const removeGroup = (group: LineGroup) => {
    const indices = new Set(Object.values(group.byQuarter));
    setLines((prev) => prev?.filter((_, i) => !indices.has(i)) ?? null);
  };

  const groups = useMemo(() => (lines ? groupLines(lines) : []), [lines]);

  const handleSave = () => {
    if (!lines) return;

    const payloadLines: BudgetLimitCorrectionLine[] = lines.map((line) => ({
      functional_class: line.functional_class,
      economic_class: line.economic_class,
      year: line.year,
      quarter: line.quarter as BudgetLimitCorrectionLine["quarter"],
      amount: line.amount,
    }));

    createBudgetLimitCorrection(
      { reason, lines: payloadLines },
      {
        onSuccess: () => {
          toast.success(
            "Черновик заявки на корректировку лимитов создан — отправить на согласование можно в «Заявки на изменение»",
          );
          close();
        },
        onError: (error) =>
          handleHttpError(error, "Не удалось создать заявку", true),
      },
    );
  };

  const hasIssues =
    report &&
    (report.excluded.length > 0 ||
      report.functional_not_found.length > 0 ||
      report.economic_not_found.length > 0);

  return (
    <Drawer open={open} onOpenChange={(v) => !v && close()} direction="right">
      <DrawerContent
        className={cn(
          "flex flex-col",
          "data-[vaul-drawer-direction=right]:w-[calc(100%-50px)]",
          "data-[vaul-drawer-direction=right]:sm:max-w-[calc(100%-50px)]",
        )}>
        <DrawerHeader>
          <DrawerTitle>Импорт корректировки лимитов из файла</DrawerTitle>
        </DrawerHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-2">
          {!lines && (
            <>
              <p className="text-muted-foreground text-sm">
                Загрузите файл Казначейства (<code>fin_YYYY.xlsb</code>) — он
                будет разобран и показан на проверку, без сохранения в базу.
                Сохранить разобранные строки можно будет на следующем шаге,
                после проверки и, при необходимости, правки.
              </p>

              <Field>
                <FieldLabel>Файл</FieldLabel>
                <Input
                  type="file"
                  accept=".xlsb,.xlsx,.xls"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </Field>

              <Field className="w-32">
                <FieldLabel>Год</FieldLabel>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                />
              </Field>
            </>
          )}

          {lines && report && (
            <>
              <p className="text-sm">
                Разобрано строк: <strong>{report.rows_total}</strong>,
                сопоставлено статей: <strong>{report.matched_articles}</strong>.
              </p>

              {hasIssues && (
                <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm">
                  <p className="font-medium">
                    Не вошло в предпросмотр (не ошибка — проверьте, что это
                    ожидаемо):
                  </p>
                  {report.excluded.length > 0 && (
                    <p>
                      Исключено правилом (статьи вне зоны ответственности ГКСЭ):{" "}
                      {report.excluded.length}
                    </p>
                  )}
                  {report.functional_not_found.length > 0 && (
                    <p>
                      Функциональные коды не найдены в справочнике:{" "}
                      {report.functional_not_found.join(", ")}
                    </p>
                  )}
                  {report.economic_not_found.length > 0 && (
                    <p>
                      Экономические коды не найдены в справочнике:{" "}
                      {report.economic_not_found.join(", ")}
                    </p>
                  )}
                </div>
              )}

              <Field>
                <FieldLabel>Обоснование</FieldLabel>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Например: корректировка лимитов по данным Казначейства за …"
                />
              </Field>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Статья</TableHead>
                    {QUARTERS.map((q) => (
                      <TableHead key={q}>{QUARTER_COLUMN_LABELS[q]}</TableHead>
                    ))}
                    <TableHead>Итого</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => {
                    const total = QUARTERS.reduce((sum, q) => {
                      const index = group.byQuarter[q];
                      return (
                        sum +
                        (index !== undefined
                          ? Number(lines[index]?.amount ?? 0)
                          : 0)
                      );
                    }, 0);

                    return (
                      <TableRow key={group.key}>
                        <TableCell>
                          <div className="font-medium">
                            {group.economicDetail.description}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {group.economicDetail.code_api} ·{" "}
                            {group.functionalDetail.description ??
                              group.functionalDetail.code_api}
                          </div>
                        </TableCell>
                        {QUARTERS.map((q) => {
                          const index = group.byQuarter[q];
                          return (
                            <TableCell key={q}>
                              {index !== undefined ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={lines[index]?.amount ?? ""}
                                  onChange={(e) =>
                                    updateAmount(index, e.target.value)
                                  }
                                  className="w-32"
                                />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          );
                        })}
                        <TableCell className="font-medium">
                          {formatByn(total)}
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeGroup(group)}>
                            <Trash2Icon
                              size={16}
                              className="text-muted-foreground"
                            />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          )}
        </div>

        <DrawerFooter>
          {!lines ? (
            <>
              <Button onClick={handlePreview} disabled={!file || isPreviewing}>
                {isPreviewing && (
                  <Loader2Icon size={16} className="animate-spin" />
                )}
                Разобрать файл
              </Button>
              <DrawerClose asChild>
                <Button type="button" variant="outline" onClick={close}>
                  Отмена
                </Button>
              </DrawerClose>
            </>
          ) : (
            <>
              <Button
                onClick={handleSave}
                disabled={isSaving || lines.length === 0 || !reason}>
                {isSaving && <Loader2Icon size={16} className="animate-spin" />}
                Сохранить
              </Button>
              <Button type="button" variant="outline" onClick={reset}>
                Назад к выбору файла
              </Button>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
