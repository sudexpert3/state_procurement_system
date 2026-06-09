import type { ProcurementPlanItem } from "@/types/data.types";


import { href, useNavigate } from "react-router";

import { ROUTES } from "@/shared/model/routes";
import { DataTable } from "@/shared/ui/data-table/data-table";

import { columns } from "./columns";
import { TableActions } from "./table-actions";

const data: ProcurementPlanItem[] = [
  {
    id: "1",
    planPointNumber: "1.1",
    goodsName: "Компьютерная техника",
    okrbCode: "28.23.11.000",
    okrbSubType: "Персональные компьютеры",
    subject: "Закупка персональных компьютеров для нужд учреждения",
    volume: 25,
    cost: 125000,
    period: "I квартал 2026 г.",
  },
  {
    id: "2",
    planPointNumber: "1.2",
    goodsName: "Мебель офисная",
    okrbCode: "31.01.11.000",
    okrbSubType: "Офисные кресла и стулья",
    subject: "Приобретение офисной мебели для нового филиала",
    volume: 40,
    cost: 18500,
    period: "II квартал 2026 г.",
  },
  {
    id: "3",
    planPointNumber: "1.3",
    goodsName: "Программное обеспечение",
    okrbCode: "58.29.12.000",
    okrbSubType: "Системы управления базами данных",
    subject: "Лицензии на СУБД для информационной системы",
    volume: 5,
    cost: 42000,
    period: "I квартал 2026 г.",
  },
  {
    id: "4",
    planPointNumber: "2.1",
    goodsName: "Услуги связи",
    okrbCode: "61.10.11.000",
    okrbSubType: "Услуги доступа к интернету",
    subject: "Интернет-доступ для учреждений на 2026 год",
    volume: 12,
    cost: 36000,
    period: "Ежемесячно в 2026 г.",
  },
  {
    id: "5",
    planPointNumber: "2.2",
    goodsName: "Канцелярские товары",
    okrbCode: "17.12.11.000",
    okrbSubType: "Бумага офисная",
    subject: "Закупка офисной бумаги и расходных материалов",
    volume: 500,
    cost: 8200,
    period: "III квартал 2026 г.",
  },
  {
    id: "6",
    planPointNumber: "3.1",
    goodsName: "Работы по ремонту",
    okrbCode: "41.20.11.000",
    okrbSubType: "Ремонт зданий нежилых",
    subject: "Капитальный ремонт административного здания",
    volume: 1,
    cost: 450000,
    period: "II–III квартал 2026 г.",
  },
  {
    id: "7",
    planPointNumber: "3.2",
    goodsName: "Оборудование медицинское",
    okrbCode: "26.60.11.000",
    okrbSubType: "Аппараты рентгеновские",
    subject: "Закупка рентген-диагностического комплекса",
    volume: 2,
    cost: 890000,
    period: "IV квартал 2026 г.",
  },
  {
    id: "8",
    planPointNumber: "4.1",
    goodsName: "Услуги транспортные",
    okrbCode: "49.41.11.000",
    okrbSubType: "Услуги грузового автотранспорта",
    subject: "Перевозка имущества при переезде филиала",
    volume: 15,
    cost: 12400,
    period: "II квартал 2026 г.",
  },
  {
    id: "9",
    planPointNumber: "4.2",
    goodsName: "Оборудование полиграфическое",
    okrbCode: "28.95.11.000",
    okrbSubType: "Принтеры и МФУ",
    subject: "Закупка многофункциональных устройств",
    volume: 8,
    cost: 64000,
    period: "I квартал 2026 г.",
  },
  {
    id: "10",
    planPointNumber: "5.1",
    goodsName: "Услуги консалтинговые",
    okrbCode: "70.22.11.000",
    okrbSubType: "Консультации в области информационных технологий",
    subject: "Аудит информационной безопасности",
    volume: 1,
    cost: 55000,
    period: "III квартал 2026 г.",
  },
  {
    id: "11",
    planPointNumber: "5.2",
    goodsName: "Оборудование медицинское",
    okrbCode: "26.60.11.000",
    okrbSubType: "Аппараты рентгеновские",
    subject: "Закупка рентген-диагностического комплекса",
    volume: 2,
    cost: 890000,
    period: "IV квартал 2026 г.",
  },
  {
    id: "12",
    planPointNumber: "6.1",
    goodsName: "Оборудование медицинское",
    okrbCode: "26.60.11.000",
    okrbSubType: "Аппараты рентгеновские",
    subject: "Закупка рентген-диагностического комплекса",
    volume: 2,
    cost: 890000,
    period: "IV квартал 2026 г.",
  },
  {
    id: "13",
    planPointNumber: "6.2",
    goodsName: "Оборудование медицинское",
    okrbCode: "26.60.11.000",
    okrbSubType: "Аппараты рентгеновские",
    subject: "Закупка рентген-диагностического комплекса",
    volume: 2,
    cost: 890000,
    period: "IV квартал 2026 г.",
  },
];

const ProcurementsPage = () => {
  const navigate = useNavigate();
  const getRow = (row: ProcurementPlanItem) => {
    navigate(href(ROUTES.PROCUREMENT, { id: row.id }), { state: row });
  };
  // const getAuth = async () => {
  //   const res = await axios.get(CONFIG.API_BASE_URL + "/gpz");
  //   console.log(res);
  // };
  // useEffect(() => {
  //   getAuth();
  // }, []);

  return (
    <div className="max-w-full">
      <TableActions />
      <div className="w-full shrink">
        <DataTable data={data} columns={columns} getRow={getRow} />
      </div>
    </div>
  );
};

export const Component = ProcurementsPage;
