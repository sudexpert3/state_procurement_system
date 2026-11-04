import type {
  ChangeRequestKind,
  ChangeRequestStatus,
} from "@/services/change-requests";

import {
  CHANGE_REQUEST_KIND_OPTIONS,
  CHANGE_REQUEST_STATUS_OPTIONS,
} from "@/services/change-requests";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

type Props = {
  statusFilter: ChangeRequestStatus | "all";
  onStatusFilterChange: (value: ChangeRequestStatus | "all") => void;
  kindFilter: ChangeRequestKind | "all";
  onKindFilterChange: (value: ChangeRequestKind | "all") => void;
};

export const ChangeRequestsToolbar = ({
  statusFilter,
  onStatusFilterChange,
  kindFilter,
  onKindFilterChange,
}: Props) => (
  <div className="flex items-center gap-4">
    <Select
      value={statusFilter}
      onValueChange={(v) =>
        onStatusFilterChange(v as ChangeRequestStatus | "all")
      }>
      <SelectTrigger className="w-56 bg-white">
        <SelectValue placeholder="Статус..." />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectGroup>
          <SelectItem value="all">Все статусы</SelectItem>
          {CHANGE_REQUEST_STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>

    <Select
      value={kindFilter}
      onValueChange={(v) => onKindFilterChange(v as ChangeRequestKind | "all")}>
      <SelectTrigger className="w-72 bg-white">
        <SelectValue placeholder="Вид заявки..." />
      </SelectTrigger>
      <SelectContent position="popper">
        <SelectGroup>
          <SelectItem value="all">Все виды</SelectItem>
          {CHANGE_REQUEST_KIND_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
);
