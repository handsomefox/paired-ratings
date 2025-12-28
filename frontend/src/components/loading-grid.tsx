import CardGrid from "@/components/card-grid";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type LoadingGridProps = {
  count?: number;
  className?: string;
};

const skeletons = Array.from({ length: 8 }, (_, index) => index);

export function LoadingGrid({ count = 8, className }: LoadingGridProps) {
  const items = count > 0 ? skeletons.slice(0, count) : skeletons;

  return (
    <CardGrid className={className}>
      {items.map((id) => (
        <Card
          key={id}
          className="flex flex-col overflow-hidden border-border/60 bg-card/70 shadow-lg"
        >
          <Skeleton className="h-[320px] w-full rounded-none sm:aspect-[2/3] sm:h-auto" />
          <CardContent className="flex flex-1 flex-col gap-2.5 p-3 sm:gap-3 sm:p-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </CardContent>
        </Card>
      ))}
    </CardGrid>
  );
}
