import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type FiltersPaneContentProps = {
  children: ReactNode;
  className?: string;
};

export function FiltersPaneContent({ children, className }: FiltersPaneContentProps) {
  return <div className={cn("w-full min-w-0 space-y-4", className)}>{children}</div>;
}
