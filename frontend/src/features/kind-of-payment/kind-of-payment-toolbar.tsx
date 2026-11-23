import { SearchIcon } from "lucide-react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/shared/components/ui/input-group";

import {
  KindOfPaymentFilter,
  type RefundFilterValue,
} from "./kind-of-payment-filter";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  refundFilter: RefundFilterValue;
  onRefundFilterChange: (value: RefundFilterValue) => void;
};

export const KindOfPaymentToolbar = ({
  search,
  onSearchChange,
  refundFilter,
  onRefundFilterChange,
}: Props) => (
  <div className="flex items-center gap-4">
    <InputGroup className="max-w-sm bg-white">
      <InputGroupAddon>
        <SearchIcon size={16} />
      </InputGroupAddon>
      <InputGroupInput
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Поиск по наименованию"
      />
    </InputGroup>
    <KindOfPaymentFilter
      value={refundFilter}
      onValueChange={onRefundFilterChange}
    />
  </div>
);
