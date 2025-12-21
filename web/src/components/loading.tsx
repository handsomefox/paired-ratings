import type { ReactNode } from "react";

export function Loading({ label = "Loading..." }: { label?: string }): ReactNode {
  return (
    <div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
      <span className="animate-pulse">{label}</span>
    </div>
  );
}
