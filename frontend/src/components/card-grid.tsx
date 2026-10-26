import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The columns of a full-width page grid. Each step keeps a card about 240 px
 * wide next to the filters pane.
 */
const pageColumns =
  "grid-cols-2 md:grid-cols-3 min-[85rem]:grid-cols-4 min-[106.25rem]:grid-cols-5";

type CardGridProps = {
  children: ReactNode;
  /** Replaces the page columns, for a grid inside a narrower container. */
  columns?: string;
  className?: string;
};

export function CardGrid({ children, columns = pageColumns, className }: CardGridProps) {
  return (
    <div className={cn("grid w-full min-w-0 gap-3 sm:gap-5 lg:gap-6", columns, className)}>
      {children}
    </div>
  );
}
