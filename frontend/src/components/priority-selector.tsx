import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const priorityValues = [1, 2, 3, 4, 5];

type PrioritySelectorProps = {
  value: number | null;
  onChange: (value: number | null) => void;
  tone?: "bf" | "gf";
  disabled?: boolean;
  className?: string;
};

export function PrioritySelector({ value, onChange, tone, disabled, className }: PrioritySelectorProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {priorityValues.map((priority) => {
        const active = value === priority;
        return (
          <Button
            key={priority}
            type="button"
            variant={active && tone ? tone : "outline"}
            size="icon"
            className={cn(
              "h-8 w-8 rounded-full text-xs",
              active || tone ? "" : "text-muted-foreground",
            )}
            onClick={() => onChange(priority)}
            disabled={disabled}
            aria-pressed={active}
          >
            {priority}
          </Button>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full text-xs text-muted-foreground"
        onClick={() => onChange(null)}
        disabled={disabled || value === null}
        aria-label="Clear priority"
      >
        x
      </Button>
    </div>
  );
}
