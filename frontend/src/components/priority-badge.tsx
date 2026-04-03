import { cn } from "@/lib/utils";

export type PriorityBadgeProps = {
  label: string;
  warning?: boolean;
  title?: string;
  className?: string;
};

export function PriorityBadge({ label, warning, title, className }: PriorityBadgeProps) {
  return (
    <div
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-xs font-semibold text-primary shadow-sm",
        warning ? "border-destructive/50 text-destructive" : "",
        className,
      )}
      title={title}
      aria-label={title}
    >
      {label}
    </div>
  );
}
