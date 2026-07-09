export const formatDate = (value: Date | string | null | undefined) =>
  value ? new Date(value).toLocaleDateString("ru-RU") : "—";
