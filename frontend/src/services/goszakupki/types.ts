// /api/gosakupki/* и /api/goszakupki/* — plain APIView без serializer_class,
// drf-spectacular не генерирует ни параметров, ни формы ответа (см.
// doc/frontend_handoff.md, раздел 8). Формы заданы руками по тексту бэкенд-агента.

export type SyncStats = {
  status: string;
  details: {
    TOTAL_PLAN_ITEM_COUNT?: number;
    imported_plan_item_count?: number;
    updated_plan_item_count?: number;
    skiped_plan_item_count?: number;
    [key: string]: unknown;
  };
};

export type PushSucceeded = {
  plan_item_id: number;
  num: string;
  action: "create" | "update";
  purchases_item_id: number;
};

export type PushFailed = {
  plan_item_id: number;
  error: string;
};

export type PushResult = {
  succeeded: PushSucceeded[];
  failed: PushFailed[];
};
