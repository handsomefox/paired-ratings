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
