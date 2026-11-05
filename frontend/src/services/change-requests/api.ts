import type {
  CalibrateDepartmentLimitsPayload,
  ChangeRequest,
  ChangeRequestKind,
  ChangeRequestStatus,
  RedistributePayload,
  RejectPayload,
} from "./types";

import { keepPreviousData } from "@tanstack/react-query";

import { rqClient } from "@/shared/api/instance";
import { queryClient } from "@/shared/api/query-client";

const LIST_QUERY_KEY = ["get", "/api/change_requests/"];
const FORECAST_QUERY_KEY = ["get", "/api/change_requests/{id}/forecast/"];

export const invalidateChangeRequests = () =>
  queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY });

export const invalidateChangeRequestForecast = () =>
  queryClient.invalidateQueries({ queryKey: FORECAST_QUERY_KEY });

export const useChangeRequestsQuery = (params: {
  status?: ChangeRequestStatus;
  kind?: ChangeRequestKind;
  plan_item?: number;
  limit: number;
  offset: number;
}) =>
  rqClient.useQuery(
    "get",
    "/api/change_requests/",
    { params: { query: params } },
    // При переходе между страницами/фильтрами показываем прошлые данные, пока грузятся новые
    { placeholderData: keepPreviousData },
  );

/**
 * Заявки конкретной позиции плана (для карточки позиции) — бизнес-правило
 * "не больше одной открытой (DRAFT/ON_REVIEW) заявки на позицию одновременно"
 * означает, что среди результатов есть не более одной открытой.
 */
export const usePlanItemChangeRequestsQuery = (planItemId: number) =>
  rqClient.useQuery("get", "/api/change_requests/", {
    params: { query: { plan_item: planItemId, limit: 100 } },
  });

export const useChangeRequestForecastQuery = (id: number | null) =>
  rqClient.useQuery(
    "get",
    "/api/change_requests/{id}/forecast/",
    { params: { path: { id: id ?? 0 } } },
    { enabled: id !== null },
  );

export const useCreateChangeRequest = () => {
  const mutation = rqClient.useMutation("post", "/api/change_requests/");

  return {
    ...mutation,
    create: (
      payload: { plan_item: number; kind: ChangeRequestKind; reason?: string },
      options?: {
        onSuccess?: (created: ChangeRequest) => void;
        onError?: (error: unknown) => void;
      },
    ) =>
      mutation.mutate(
        {
          // Базовый ModelViewSet.create() (не кастомный @action, поэтому не затронут
          // недавней типизацией forecast/submit/approve/...) переиспользует полный
          // ChangeRequestSerializer — read-only поля (id/kind_display/...) DRF
          // игнорирует на вход, но без них объектный литерал не проходит
          // структурную проверку типа.
          body: {
            ...payload,
            id: 0,
            plan_item_num: "",
            kind_display: "",
            status: "DRAFT",
            status_display: "",
            rejection_reason: "",
            submitted_at: null,
            reviewed_at: null,
            created_at: "",
            changed_at: "",
          } as unknown as ChangeRequest,
        },
        {
          onSuccess: (created) => options?.onSuccess?.(created),
          onError: options?.onError,
        },
      ),
  };
};

export const useCalibrateDepartmentLimits = () => {
  const mutation = rqClient.useMutation(
    "post",
    "/api/change_requests/calibrate_department_limits/",
  );

  return {
    ...mutation,
    calibrate: (
      payload: CalibrateDepartmentLimitsPayload,
      options?: {
        onSuccess?: (created: ChangeRequest) => void;
        onError?: (error: unknown) => void;
      },
    ) =>
      mutation.mutate(
        { body: payload },
        {
          onSuccess: (created) => options?.onSuccess?.(created),
          onError: options?.onError,
        },
      ),
  };
};

export const useCreateRedistribution = () => {
  const mutation = rqClient.useMutation(
    "post",
    "/api/change_requests/redistribute/",
  );

  return {
    ...mutation,
    createRedistribution: (
      payload: RedistributePayload,
      options?: {
        onSuccess?: (created: ChangeRequest) => void;
        onError?: (error: unknown) => void;
      },
    ) =>
      mutation.mutate(
        { body: payload },
        {
          onSuccess: (created) => options?.onSuccess?.(created),
          onError: options?.onError,
        },
      ),
  };
};

export const useSubmitChangeRequest = () => {
  const mutation = rqClient.useMutation(
    "post",
    "/api/change_requests/{id}/submit/",
  );

  return {
    ...mutation,
    submit: (
      id: number,
      options?: { onSuccess?: () => void; onError?: (error: unknown) => void },
    ) =>
      mutation.mutate(
        { params: { path: { id } } },
        {
          onSuccess: () => {
            invalidateChangeRequests();
            options?.onSuccess?.();
          },
          onError: options?.onError,
        },
      ),
  };
};

export const useApproveChangeRequest = () => {
  const mutation = rqClient.useMutation(
    "post",
    "/api/change_requests/{id}/approve/",
  );

  return {
    ...mutation,
    approve: (
      id: number,
      options?: { onSuccess?: () => void; onError?: (error: unknown) => void },
    ) =>
      mutation.mutate(
        { params: { path: { id } } },
        {
          onSuccess: () => {
            invalidateChangeRequests();
            options?.onSuccess?.();
          },
          onError: options?.onError,
        },
      ),
  };
};

export const useRejectChangeRequest = () => {
  const mutation = rqClient.useMutation(
    "post",
    "/api/change_requests/{id}/reject/",
  );

  return {
    ...mutation,
    reject: (
      id: number,
      payload: RejectPayload,
      options?: { onSuccess?: () => void; onError?: (error: unknown) => void },
    ) =>
      mutation.mutate(
        { params: { path: { id } }, body: payload },
        {
          onSuccess: () => {
            invalidateChangeRequests();
            options?.onSuccess?.();
          },
          onError: options?.onError,
        },
      ),
  };
};
