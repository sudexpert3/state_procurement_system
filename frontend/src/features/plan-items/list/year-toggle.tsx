import { Button } from "@/shared/components/ui/button";

type Props = {
  years: { year: number; purchaseId: number }[];
  activePurchaseId: number | null;
  onSelect: (purchaseId: number) => void;
};

export const YearToggle = ({ years, activePurchaseId, onSelect }: Props) => (
  <div className="flex flex-wrap gap-1">
    {years.map(({ year, purchaseId }) => (
      <Button
        key={purchaseId}
        type="button"
        size="sm"
        variant={purchaseId === activePurchaseId ? "default" : "outline"}
        onClick={() => onSelect(purchaseId)}>
        {year}
      </Button>
    ))}
  </div>
);
