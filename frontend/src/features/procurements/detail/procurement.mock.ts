import type { ProcurementFormValues } from "../create/schema";

import { contractsMock } from "../create/form/contract-section/contracts.mock";

// Статусы плана закупки (as const вместо enum — правило проекта).
export const procurementStatus = {
  DRAFT: "draft",
  PUBLISHED: "published",
  ARCHIVED: "archived",
} as const;

export type ProcurementStatus =
  (typeof procurementStatus)[keyof typeof procurementStatus];

// Строка таблицы подразделений внутри года финансирования.
export type FinancingDepartment = {
  id: number;
  name: string; // наименование подразделения
  quantity: number; // количество
  units: string; // ед. измерения
  totalSum: number; // общая сумма подразделения, BYN
  treasurySum: number; // сумма казначейства, BYN
  ownFunds: number; // собственные средства, BYN
  customerPaymentSum: number; // оплата со счетов заказчика, BYN
};

// Сведения о финансировании по одному году (как отдельный предмет закупки).
export type FinancingYear = {
  id: number;
  year: number; // год финансирования
  yearSum: number; // сумма финансирования года, BYN
  functionalClass: string; // функциональная классификация (код + наименование)
  economicClass: string; // экономическая классификация
  economicClassInternal: string; // эконом. классификация внутренняя
  programClass: string; // программная классификация
  departmentalClass: string; // ведомственная классификация
  customerUnp: string; // УНК заказчика
  tkCode: string; // код ТК
  budgetCode: string; // код бюджета
  budgetCodeName: string; // наименование кода бюджета
  treasuryPayment: number; // оплата со счетов казначейства, BYN
  customerPayment: number; // оплата со счетов заказчика, BYN
  ownFunds: number; // собственные средства, BYN
  departments: FinancingDepartment[]; // разбивка по подразделениям
};

// План закупки целиком (как его отдаст GET /api/procurements/{id}/).
// id и status добавлены поверх формы — на бэке они есть, в схеме формы нет.
export type ProcurementDetail = ProcurementFormValues & {
  id: number;
  status: ProcurementStatus;
  financing: FinancingYear[];
};

// Демо-данные по финансированию (максимум 3 года). Заменятся ответом API.
export const financingMock: FinancingYear[] = [
  {
    id: 1,
    year: 2024,
    yearSum: 50000,
    functionalClass: "1 10 10 — Общегосударственная деятельность",
    economicClass: "1 30 40 — Приобретение основных средств",
    economicClassInternal: "1 30 40 01",
    programClass: "0100 — Государственное управление",
    departmentalClass: "010 — Аппарат управления",
    customerUnp: "100024579",
    tkCode: "ТК-001",
    budgetCode: "03601",
    budgetCodeName: "Республиканский бюджет",
    treasuryPayment: 40000,
    customerPayment: 8000,
    ownFunds: 2000,
    departments: [
      {
        id: 1,
        name: "Отдел информационных технологий",
        quantity: 15,
        units: "шт",
        totalSum: 30000,
        treasurySum: 24000,
        ownFunds: 1200,
        customerPaymentSum: 4800,
      },
      {
        id: 2,
        name: "Административно-хозяйственный отдел",
        quantity: 10,
        units: "шт",
        totalSum: 20000,
        treasurySum: 16000,
        ownFunds: 800,
        customerPaymentSum: 3200,
      },
    ],
  },
  {
    id: 2,
    year: 2025,
    yearSum: 45000,
    functionalClass: "1 10 20 — Международная деятельность",
    economicClass: "1 30 40 — Приобретение основных средств",
    economicClassInternal: "1 30 40 02",
    programClass: "0200 — Национальная экономика",
    departmentalClass: "020 — Отдел материального обеспечения",
    customerUnp: "100024579",
    tkCode: "ТК-002",
    budgetCode: "03602",
    budgetCodeName: "Местный бюджет",
    treasuryPayment: 35000,
    customerPayment: 7000,
    ownFunds: 3000,
    departments: [
      {
        id: 1,
        name: "Отдел материального обеспечения",
        quantity: 25,
        units: "шт",
        totalSum: 45000,
        treasurySum: 35000,
        ownFunds: 3000,
        customerPaymentSum: 7000,
      },
    ],
  },
  {
    id: 3,
    year: 2026,
    yearSum: 30000,
    functionalClass: "1 10 30 — Национальная оборона",
    economicClass: "1 20 10 — Оплата услуг",
    economicClassInternal: "1 20 10 05",
    programClass: "0300 — Жилищно-коммунальные услуги",
    departmentalClass: "030 — Финансовый отдел",
    customerUnp: "100024579",
    tkCode: "ТК-003",
    budgetCode: "03603",
    budgetCodeName: "Бюджет государственного внебюджетного фонда",
    treasuryPayment: 20000,
    customerPayment: 6000,
    ownFunds: 4000,
    departments: [
      {
        id: 1,
        name: "Финансовый отдел",
        quantity: 8,
        units: "мес",
        totalSum: 18000,
        treasurySum: 12000,
        ownFunds: 2400,
        customerPaymentSum: 3600,
      },
      {
        id: 2,
        name: "Отдел связи",
        quantity: 4,
        units: "мес",
        totalSum: 12000,
        treasurySum: 8000,
        ownFunds: 1600,
        customerPaymentSum: 2400,
      },
    ],
  },
];

// Демо-данные для страницы деталей. Заменятся ответом API.
export const procurementDetailMock: ProcurementDetail[] = [
  {
    id: 1,
    status: procurementStatus.PUBLISHED,
    // base info
    planPointNumber: "1.1",
    okrbCode: "28.23.11.000",
    goodsName: "Персональные компьютеры для рабочих мест",
    okrbName: "Машины вычислительные электронные цифровые",
    typeOfGoodsId: "product",
    allVolume: 25,
    allCost: 125000,
    units: "шт",
    customerId: "1",
    procurementItems: [
      {
        articleNumber: 210,
        pstNumber: 4,
        elNumber: 2,
        economicClass: 1,
        subElementNumber: 3,
        elementNumber: 1,
        expenseCategory: "Капитальные расходы",
        departmentId: 1,
        volume: 25,
        cost: 125000,
      },
    ],
    // planning
    expenseCategory: "Капитальные расходы",
    viewObject: "Товары",
    viewProcedure: "Открытый конкурс",
    itemList: "Позиция 1",
    planNumber: 101,
    planDate: new Date("2026-01-15"),
    planChangeDate: new Date("2026-02-10"),
    // contracts
    currentPlanBalance: 125000,
    customerAccounts: ["3600000000001", "3600000000002"],
    contracts: contractsMock.slice(0, 2),
    financing: financingMock.slice(0, 3),
  },
  {
    id: 2,
    status: procurementStatus.DRAFT,
    planPointNumber: "1.2",
    okrbCode: "31.01.11.000",
    goodsName: "Мебель офисная для нового филиала",
    okrbName: "Мебель для сидения и её части",
    typeOfGoodsId: "product",
    allVolume: 40,
    allCost: 18500,
    units: "шт",
    customerId: "2",
    procurementItems: [
      {
        articleNumber: 211,
        pstNumber: 5,
        elNumber: 1,
        economicClass: 2,
        subElementNumber: 1,
        elementNumber: 2,
        expenseCategory: "Текущие расходы",
        departmentId: 2,
        volume: 40,
        cost: 18500,
      },
    ],
    expenseCategory: "Текущие расходы",
    viewObject: "Товары",
    viewProcedure: "Запрос ценовых предложений",
    itemList: "Позиция 2",
    planNumber: 102,
    planDate: new Date("2026-01-20"),
    planChangeDate: new Date("2026-03-05"),
    currentPlanBalance: 18500,
    customerAccounts: ["3600000000010"],
    contracts: contractsMock.slice(2, 4),
    financing: financingMock.slice(0, 1),
  },
  {
    id: 3,
    status: procurementStatus.ARCHIVED,
    planPointNumber: "2.1",
    okrbCode: "61.10.11.000",
    goodsName: "Услуги доступа к сети Интернет",
    okrbName: "Услуги по передаче данных и доступу к Интернету",
    typeOfGoodsId: "work",
    allVolume: 12,
    allCost: 36000,
    units: "мес",
    customerId: "3",
    procurementItems: [],
    expenseCategory: "Текущие расходы",
    viewObject: "Услуги",
    viewProcedure: "Процедура закупки из одного источника",
    itemList: "Позиция 3",
    planNumber: 103,
    planDate: new Date("2026-02-01"),
    planChangeDate: new Date("2026-02-01"),
    currentPlanBalance: 36000,
    customerAccounts: ["3600000000020", "3600000000021"],
    contracts: [],
    financing: financingMock.slice(1, 3),
  },
];
