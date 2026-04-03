export const baseStatusOptions = [
  { value: "all", label: "All" },
  { value: "planned", label: "Planned" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
];

export const showStatusOptions = [
  { value: "planned", label: "Planned" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
];

export type StatusBadgeVariant = "bf" | "gf" | "watching" | "outline";

export function statusBadgeVariant(status?: string): StatusBadgeVariant {
  if (status === "watched") return "bf";
  if (status === "planned") return "gf";
  if (status === "watching") return "watching";
  return "outline";
}

export type PrioritySummary = {
  label: string;
  average: number;
  warning: boolean;
};

export function getPrioritySummary(
  bfPriority?: number | null,
  gfPriority?: number | null,
): PrioritySummary | null {
  const values = [bfPriority, gfPriority].filter(
    (value): value is number => typeof value === "number",
  );
  if (values.length === 0) return null;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const warning = values.length === 1;
  const rounded = Number.isInteger(average) ? String(average) : average.toFixed(1);
  return {
    label: warning ? `${rounded}!` : rounded,
    average,
    warning,
  };
}
