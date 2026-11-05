// /api/gosakupki/* и /api/goszakupki/* — plain APIView без serializer_class,
// drf-spectacular не генерирует ни параметров, ни формы ответа (см.
// doc/frontend_handoff.md, раздел 8). Формы заданы руками по тексту бэкенд-агента.

// GET /api/gosakupki/get_purchases_all — views/get_data_from_goszakupki.py::get_purchases_view.
// "details" здесь не бывает вообще — только status + человекочитаемое message.
export type SyncAllResult = {
  status: "success" | "empty";
  message: string;
};

// GET /api/gosakupki/get_purchases_items/{purchase_id}/ — ::get_purchases_items.
// "details" есть только при status="success"; при "empty" (план без позиций на
// портале) — только message, как у SyncAllResult.
export type SyncItemsResult = {
  status: "success" | "empty";
  message: string;
  details?: {
    TOTAL_PLAN_ITEM_COUNT: number;
    imported_plan_item_count: number;
    updated_plan_item_count: number;
    skiped_plan_item_count: number;
    imported_budget_costs_item_count: number;
    updated_budget_costs_item_count: number;
    archived_plan_item_count: number;
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
