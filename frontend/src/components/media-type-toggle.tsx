import { cn } from "@/lib/utils";

type MediaTypeToggleProps<T extends string> = {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
};

/** The segmented control above the results that picks movies, TV shows, or both. */
export function MediaTypeToggle<T extends string>({
  options,
  value,
  onChange,
}: MediaTypeToggleProps<T>) {
  return (
    <div
      role="group"
      aria-label="Media type"
      className="inline-flex shrink-0 rounded-lg border border-border/60 bg-muted/40 p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          // Every navigation gives the history entry a new key, which loses
          // its saved scroll position, so a click on the current one does
          // nothing.
          onClick={() => {
            if (option.value !== value) onChange(option.value);
          }}
          className={cn(
            "cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:px-4",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
