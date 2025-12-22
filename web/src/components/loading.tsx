import type { ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";

export function Loading({ label = "Loading..." }: { label?: string }): ReactNode {
  return (
    <div className="text-muted-foreground flex min-h-[200px] items-center justify-center text-sm">
      <div className="flex items-center gap-2">
        <Spinner />
        <span>{label}</span>
      </div>
    </div>
  );
}
