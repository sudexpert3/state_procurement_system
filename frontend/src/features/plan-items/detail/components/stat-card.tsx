import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";

export const StatCard = ({
  title,
  value,
  valueClassName,
}: {
  title: string;
  value?: string;
  valueClassName?: string;
}) => (
  <Card className="flex-1 ring-0">
    <CardHeader className="px-4">
      <CardTitle className="text-muted-foreground text-sm font-medium">
        {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="px-4">
      <p className={cn("text-2xl font-semibold", valueClassName)}>{value}</p>
    </CardContent>
  </Card>
);
