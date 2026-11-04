import type {
  ChangeRequestForecast,
  ChangeRequestKind,
  ForecastBudgetLimitCorrection,
  ForecastDepartmentLimitCalibration,
  ForecastLimitRedistribution,
  ForecastPlanItemChange,
  ForecastPlanItemExclusion,
} from "../types";

import { Badge } from "@/shared/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { formatByn } from "@/shared/lib/helpers/format-money";

const OverBudgetBadge = ({ isOverBudget }: { isOverBudget: boolean }) =>
  isOverBudget ? (
    <Badge variant="destructive">Превышение</Badge>
  ) : (
    <Badge variant="secondary">В пределах</Badge>
  );

const PlanItemChangeForecast = ({ data }: { data: ForecastPlanItemChange }) => (
  <div className="flex flex-col gap-4">
    <div>
      <p className="mb-2 text-sm font-medium">По статьям</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Год</TableHead>
            <TableHead>Статья ЭКР</TableHead>
            <TableHead>Новая сумма</TableHead>
            <TableHead>Принятые обязательства</TableHead>
            <TableHead>Остаток/дефицит</TableHead>
            <TableHead>Статус</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.by_article.map((line, i) => (
            <TableRow key={i}>
              <TableCell>{line.year}</TableCell>
              <TableCell>{line.economic_code}</TableCell>
              <TableCell>{formatByn(line.new_allocated)}</TableCell>
              <TableCell>{formatByn(line.committed_obligations)}</TableCell>
              <TableCell>{formatByn(line.shortfall)}</TableCell>
              <TableCell>
                <OverBudgetBadge isOverBudget={line.is_over_budget} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    <div>
      <p className="mb-2 text-sm font-medium">По подразделениям</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Подразделение</TableHead>
            <TableHead>Год</TableHead>
            <TableHead>Новая сумма</TableHead>
            <TableHead>Принятые обязательства</TableHead>
            <TableHead>Остаток/дефицит</TableHead>
            <TableHead>Статус</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.by_department.map((line, i) => (
            <TableRow key={i}>
              <TableCell>{line.department}</TableCell>
              <TableCell>{line.year}</TableCell>
              <TableCell>{formatByn(line.new_allocated)}</TableCell>
              <TableCell>{formatByn(line.committed_obligations)}</TableCell>
              <TableCell>{formatByn(line.shortfall)}</TableCell>
              <TableCell>
                <OverBudgetBadge isOverBudget={line.is_over_budget} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
);

const PlanItemExclusionForecast = ({
  data,
}: {
  data: ForecastPlanItemExclusion;
}) => (
  <div>
    <p className="mb-2 text-sm font-medium">
      Что &laquo;осиротеет&raquo; при исключении позиции
    </p>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Подразделение</TableHead>
          <TableHead>Год</TableHead>
          <TableHead>Выделено</TableHead>
          <TableHead>Принятые обязательства</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.by_department.map((line, i) => (
          <TableRow key={i}>
            <TableCell>{line.department}</TableCell>
            <TableCell>{line.year}</TableCell>
            <TableCell>{formatByn(line.allocated)}</TableCell>
            <TableCell>{formatByn(line.committed_obligations)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

const RedistributionLikeForecast = ({
  data,
}: {
  data: ForecastLimitRedistribution | ForecastBudgetLimitCorrection;
}) => (
  <div className="flex flex-col gap-2">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Статья ЭКР</TableHead>
          <TableHead>Подразделение</TableHead>
          <TableHead>Квартал</TableHead>
          <TableHead>Было</TableHead>
          <TableHead>Станет</TableHead>
          <TableHead>Δ</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.lines.map((line, i) => (
          <TableRow key={i}>
            <TableCell>{line.economic_code}</TableCell>
            <TableCell>
              {"department" in line ? (line.department ?? "—") : "—"}
            </TableCell>
            <TableCell>{line.quarter}</TableCell>
            <TableCell>{formatByn(line.old_amount)}</TableCell>
            <TableCell>{formatByn(line.new_amount)}</TableCell>
            <TableCell>{formatByn(line.delta)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
    <p className="text-sm">
      Итоговое изменение:{" "}
      <span className="font-medium">{formatByn(data.net_delta)}</span>
    </p>
  </div>
);

const DepartmentLimitCalibrationForecast = ({
  data,
}: {
  data: ForecastDepartmentLimitCalibration;
}) => (
  <div className="flex flex-col gap-4">
    <div className="flex flex-wrap gap-4 text-sm">
      <span>
        Статья: <span className="font-medium">{data.economic_code}</span>
      </span>
      <span>
        Доступно (план − резерв прошлых лет):{" "}
        <span className="font-medium">{formatByn(data.article_available)}</span>
      </span>
      <span>
        Распределено по подстатьям:{" "}
        <span className="font-medium">{formatByn(data.subarticle_sum)}</span>
      </span>
      <span>
        Остаток статьи:{" "}
        <span
          className={
            data.article_diff < 0
              ? "text-destructive font-medium"
              : "font-medium"
          }>
          {formatByn(data.article_diff)}
        </span>
      </span>
      <Badge variant={data.is_balanced ? "secondary" : "destructive"}>
        {data.is_balanced
          ? "Перерасхода нет"
          : "Перерасход — одобрение заблокировано"}
      </Badge>
    </div>

    <div>
      <p className="mb-2 text-sm font-medium">Сверка по подстатьям</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Внутренний код ЭКР</TableHead>
            <TableHead>Сумма подстатьи</TableHead>
            <TableHead>Распределено держателям</TableHead>
            <TableHead>Остаток</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.subarticle_balance.map((line, i) => (
            <TableRow key={i}>
              <TableCell>{line.internal_economic_class_code}</TableCell>
              <TableCell>{formatByn(line.subarticle_total)}</TableCell>
              <TableCell>{formatByn(line.departments_sum)}</TableCell>
              <TableCell
                className={line.diff < 0 ? "text-destructive" : undefined}>
                {formatByn(line.diff)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </div>
);

type Props = {
  kind: ChangeRequestKind;
  data: ChangeRequestForecast;
};

export const ForecastView = ({ kind, data }: Props) => {
  switch (kind) {
    case "PLAN_ITEM_CHANGE":
      return <PlanItemChangeForecast data={data as ForecastPlanItemChange} />;
    case "PLAN_ITEM_EXCLUSION":
      return (
        <PlanItemExclusionForecast data={data as ForecastPlanItemExclusion} />
      );
    case "LIMIT_REDISTRIBUTION":
    case "BUDGET_LIMIT_CORRECTION":
      return (
        <RedistributionLikeForecast
          data={
            data as ForecastLimitRedistribution | ForecastBudgetLimitCorrection
          }
        />
      );
    case "DEPARTMENT_LIMIT_CALIBRATION":
      return (
        <DepartmentLimitCalibrationForecast
          data={data as ForecastDepartmentLimitCalibration}
        />
      );
    default:
      return null;
  }
};
