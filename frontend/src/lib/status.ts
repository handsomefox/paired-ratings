export const showStatusOptions = [
  { value: "planned", label: "Planned" },
  { value: "watching", label: "Watching" },
  { value: "watched", label: "Watched" },
];

export const statusFilterOptions = [{ value: "all", label: "All" }, ...showStatusOptions];

type StatusStyle = {
  /** Solid ribbon on a library card poster. */
  ribbon: string;
  /** Tinted chip, such as the status picker on the detail page. */
  chip: string;
};

const statusStyles: Record<string, StatusStyle> = {
  planned: {
    ribbon: "bg-gf/75",
    chip: "border-gf/40 bg-gf/10 text-gf hover:bg-gf/20",
  },
  watching: {
    ribbon: "bg-amber-500/75",
    chip: "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20",
  },
  watched: {
    ribbon: "bg-bf/75",
    chip: "border-bf/40 bg-bf/10 text-bf hover:bg-bf/20",
  },
};

/** A show without a status is treated as planned, which is the default on add. */
export function statusStyle(status: string): StatusStyle {
  return statusStyles[status] ?? statusStyles.planned;
}
