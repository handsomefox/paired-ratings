import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type CardGridProps = {
  children: ReactNode;
  className?: string;
};

export function CardGrid({ children, className }: CardGridProps) {
  return (
    <div
      className={cn(
        "grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6 [@media(min-width:1400px)]:grid-cols-4 [@media(min-width:1700px)]:grid-cols-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
