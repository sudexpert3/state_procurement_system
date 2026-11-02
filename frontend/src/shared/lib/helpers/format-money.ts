export const formatMoney = (value?: number | string) => {
  if (value === undefined) return undefined;
  if (typeof value === "string") value = Number(value);
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "BYN",
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatByn = (value?: number | string) => {
  if (value === undefined) return undefined;
  if (typeof value === "string") value = Number(value);

  return `${new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value)} BYN`;
};
