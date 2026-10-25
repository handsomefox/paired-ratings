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
  const clamp = (n: number) => Math.max(1, Math.min(totalPages, n));

  const startPages = Array.from({ length: Math.min(boundaryCount, totalPages) }, (_, i) => i + 1);
  const endPages = Array.from(
    { length: Math.min(boundaryCount, totalPages) },
    (_, i) => totalPages - (Math.min(boundaryCount, totalPages) - 1) + i,
  );

  const siblingsStart = clamp(currentPage - siblingCount);
  const siblingsEnd = clamp(currentPage + siblingCount);

  const innerStart = Math.max(siblingsStart, boundaryCount + 1);
  const innerEnd = Math.min(siblingsEnd, totalPages - boundaryCount);

  const items: Array<number | "ellipsis"> = [];

  startPages.forEach((page) => items.push(page));

  if (innerStart > boundaryCount + 1) items.push("ellipsis");
  for (let page = innerStart; page <= innerEnd; page += 1) items.push(page);

  if (innerEnd < totalPages - boundaryCount) items.push("ellipsis");

  endPages.forEach((page) => {
    if (!items.includes(page)) items.push(page);
  });

  return items;
}
