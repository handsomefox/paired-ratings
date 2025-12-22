import * as React from "react";

import { cn } from "@/lib/utils";

type CardGridProps = {
  children: React.ReactNode;
  className?: string;
};

const CardGrid = ({ children, className }: CardGridProps) => (
  <div
    className={cn(
      "grid w-full min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      className,
    )}
  >
    {children}
  </div>
);

export default CardGrid;
