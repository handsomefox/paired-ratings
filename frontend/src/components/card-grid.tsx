import * as React from "react";

import { cn } from "@/lib/utils";

type CardGridProps = {
  children: React.ReactNode;
  className?: string;
};

const CardGrid = ({ children, className }: CardGridProps) => (
  <div
    className={cn(
      "grid w-full min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 lg:gap-6 [@media(min-width:1400px)]:grid-cols-4 [@media(min-width:1700px)]:grid-cols-5 [@media(min-width:2200px)]:grid-cols-6",
      className,
    )}
  >
    {children}
  </div>
);

export default CardGrid;
