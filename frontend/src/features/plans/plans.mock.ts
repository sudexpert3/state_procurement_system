// Реестр годовых планов закупок — моковые данные.
// Реального API пока нет, поэтому тип и данные лежат локально рядом с фичей.

export type PlanStatus = "Опубликован" | "В архиве" | "Не актуален";

export type AnnualPlan = {
  id: string;
  giasRepostedAt: string; // ISO — дата и время переразмещения в ГИАС
  version: string; // версия плана
  gzbId: string; // идентификационный номер годового плана ГЗБ
  name: string; // наименование
  updatedAt: string; // ISO — дата и время последнего изменения
  status: PlanStatus;
  unp: string; // УНП
};

export const plansMock: AnnualPlan[] = [
  {
    id: "1",
    giasRepostedAt: "2026-01-15T09:30:00",
    version: "3",
    gzbId: "ГПЗ-2026-000123",
    name: "Годовой план государственных закупок на 2026 год",
    updatedAt: "2026-06-28T14:12:00",
    status: "Опубликован",
    unp: "190000001",
  },
  {
    id: "2",
    giasRepostedAt: "2025-02-10T11:05:00",
    version: "7",
    gzbId: "ГПЗ-2025-000087",
    name: "Годовой план государственных закупок на 2025 год",
    updatedAt: "2025-12-30T17:45:00",
    status: "В архиве",
    unp: "190000002",
  },
  {
    id: "3",
    giasRepostedAt: "2026-03-02T08:20:00",
    version: "1",
    gzbId: "ГПЗ-2026-000205",
    name: "Годовой план государственных закупок (резервный)",
    updatedAt: "2026-05-19T10:00:00",
    status: "Не актуален",
    unp: "190000003",
  },
];
