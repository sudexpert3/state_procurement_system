export const formatDate = (date: Date | null) =>
  date ? date.toLocaleDateString("ru-RU") : "—";
