function range(from: number, to: number): number[] {
  return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
}

/**
 * Page numbers to show in a pager: the first and last `boundaryCount` pages,
 * `siblingCount` pages either side of the current one, and "ellipsis" for
 * each gap.
 */
export function getPageItems(
  totalPages: number,
  currentPage: number,
  siblingCount = 2,
  boundaryCount = 1,
): Array<number | "ellipsis"> {
  const shown = new Set([
    ...range(1, Math.min(boundaryCount, totalPages)),
    ...range(
      Math.max(currentPage - siblingCount, 1),
      Math.min(currentPage + siblingCount, totalPages),
    ),
    ...range(Math.max(totalPages - boundaryCount + 1, 1), totalPages),
  ]);

  const items: Array<number | "ellipsis"> = [];
  let previous = 0;
  for (const page of [...shown].sort((a, b) => a - b)) {
    // An ellipsis takes a slot of its own, so it would hide a single page
    // without saving any room. Show that page instead.
    if (page - previous === 2) items.push(previous + 1);
    else if (page - previous > 2) items.push("ellipsis");
    items.push(page);
    previous = page;
  }
  return items;
}
