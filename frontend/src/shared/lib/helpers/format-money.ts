// Сумма в BYN валютным стилем, целые (для крупных сумм плана/договоров).
export const formatMoney = (value?: number) =>
  value === undefined
    ? undefined
    : new Intl.NumberFormat("ru-RU", {
        style: "currency",
        currency: "BYN",
        maximumFractionDigits: 0,
      }).format(value);

// Сумма с явной подписью «BYN», 2 знака (блоки финансирования/подразделений).
export const formatByn = (value?: number) =>
  value === undefined
    ? undefined
    : `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} BYN`;
