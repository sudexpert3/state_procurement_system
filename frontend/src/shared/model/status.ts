export const STATUS_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "true", label: "Действующие" },
  { value: "false", label: "Не действующие" },
] as const;

export type StatusFilterValue = (typeof STATUS_OPTIONS)[number]["value"];
