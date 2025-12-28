export const baseStatusOptions = [
  { value: "all", label: "All" },
  { value: "planned", label: "Planned" },
  { value: "watched", label: "Watched" },
];

export type StatusBadgeVariant = "bf" | "gf" | "outline";

export function statusBadgeVariant(status?: string): StatusBadgeVariant {
  if (status === "watched") return "bf";
  if (status === "planned") return "gf";
  return "outline";
}
