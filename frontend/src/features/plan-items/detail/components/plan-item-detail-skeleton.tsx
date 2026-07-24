import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import { Skeleton } from "@/shared/components/ui/skeleton";

const DetailFieldSkeleton = () => (
  <div className="space-y-2">
    <Skeleton className="h-3 w-24" />
    <Skeleton className="h-5 w-full max-w-64" />
  </div>
);

export const PlanItemDetailSkeleton = () => (
  <div
    className="w-full space-y-4"
    aria-label="Загрузка карточки пункта плана"
    aria-busy="true">
    <Card className="ring-0">
      <CardHeader className="px-2">
        <Skeleton className="h-6 w-full max-w-80" />
        <CardAction>
          <Skeleton className="h-12 w-44" />
        </CardAction>
      </CardHeader>
      <Separator />
      <CardContent className="grid grid-cols-2 gap-4 px-2 md:grid-cols-4">
        <DetailFieldSkeleton />
        <DetailFieldSkeleton />
        <DetailFieldSkeleton />
        <DetailFieldSkeleton />
      </CardContent>
    </Card>

    <div className="space-y-2">
      <div className="flex gap-2">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-9 w-24" />
      </div>

      <Card className="ring-0">
        <CardHeader className="px-2">
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <Separator />
        <CardContent className="grid grid-cols-2 gap-4 px-2 md:grid-cols-3">
          <DetailFieldSkeleton />
          <DetailFieldSkeleton />
          <DetailFieldSkeleton />
          <DetailFieldSkeleton />
          <DetailFieldSkeleton />
          <DetailFieldSkeleton />
          <DetailFieldSkeleton />
          <DetailFieldSkeleton />
          <DetailFieldSkeleton />
        </CardContent>
      </Card>
    </div>
  </div>
);
