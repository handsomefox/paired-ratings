import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type FiltersPaneContentProps = {
  children: ReactNode;
  className?: string;
};

export function FiltersPaneContent({ children, className }: FiltersPaneContentProps) {
  return (
    <div className={cn("w-full min-w-0", className)}>
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 space-y-4">{children}</div>
    </div>
  );
}
