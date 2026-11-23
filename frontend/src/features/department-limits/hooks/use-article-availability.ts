import type { ArticleAvailability } from "@/shared/api/schema";

import { useQuery } from "@tanstack/react-query";

import { authorizedFetch } from "@/shared/lib/helpers/authorized-fetch";

type Params = {
  functionalClass: number | null;
  economicClass: number | null;
  year: number | null;
  /** id правящейся записи — исключить из allocated_total её собственное старое значение */
  exclude?: number;
};

// `GET .../article_availability/` — @action без @extend_schema(parameters=...),
// drf-spectacular не описал query-параметры (сгенерированный тип — `query: never`),
// поэтому, как и /api/reports/* (см. services/reports/api.ts), идём через
// authorizedFetch, а не через типизированный rqClient.
export const useArticleAvailability = ({
  functionalClass,
  economicClass,
  year,
  exclude,
}: Params) => {
  const enabled =
    functionalClass !== null && economicClass !== null && year !== null;

  return useQuery({
    queryKey: [
      "department_article_limits",
      "article_availability",
      functionalClass,
      economicClass,
      year,
      exclude,
    ],
    queryFn: () => {
      const search = new URLSearchParams();
      if (functionalClass !== null)
        search.set("functional_class", String(functionalClass));
      if (economicClass !== null)
        search.set("economic_class", String(economicClass));
      if (year !== null) search.set("year", String(year));
      if (exclude !== undefined) search.set("exclude", String(exclude));

      return authorizedFetch<ArticleAvailability>(
        `/api/department_article_limits/article_availability/?${search.toString()}`,
      );
    },
    enabled,
  });
};
