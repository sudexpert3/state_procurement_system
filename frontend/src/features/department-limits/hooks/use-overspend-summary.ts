import type { OverspendSummaryLine } from "@/shared/api/schema";

import { rqClient } from "@/shared/api/instance";

// Для баннера перерасхода на странице — список статей/параграфов года, где
// распределено больше, чем доступно (не блокирует, только предупреждает,
// см. CurrentStatus.md). Статей с перерасходом ожидается немного, лимит
// запроса — с запасом, как и в других местах проекта (contractsQuery limit: 1000).
export const useOverspendSummary = (year: number) =>
  rqClient.useQuery(
    "get",
    "/api/department_article_limits/overspend_summary/",
    {
      params: { query: { year, limit: 1000 } },
    },
    {
      // Экшен не вызывает paginate_queryset() — фактический ответ плоский
      // массив, хотя drf-spectacular описал его как пагинированный объект
      // (проверено на живых данных: GET .../overspend_summary/ -> `[]`, а не
      // `{results: [...]}`). Нормализуем на случай, если бэкенд это поправит.
      select: (data) =>
        Array.isArray(data)
          ? (data as unknown as OverspendSummaryLine[])
          : (data.results ?? []),
    },
  );
