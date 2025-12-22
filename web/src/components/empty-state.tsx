import * as React from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  children: React.ReactNode;
  className?: string;
};

const EmptyState = ({ children, className }: EmptyStateProps) => (
  <div
    className={cn(
      "rounded-2xl border border-dashed border-border/60 bg-card/30 p-10 text-center text-sm text-muted-foreground",
      className,
    )}
  >
    {children}
  </div>
);

export default EmptyState;
