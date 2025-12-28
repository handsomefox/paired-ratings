import { sortOptions, type MediaType, type Sort } from "@/features/search/search-constants";

export function sanitizeMediaType(raw: string | null | undefined): MediaType {
  const value = (raw ?? "").toLowerCase().trim();
  return value === "tv" ? "tv" : "movie";
}

export function sanitizeSort(raw: string | null | undefined): Sort {
  const value = (raw ?? "").toLowerCase().trim();
  return sortOptions.some((option) => option.value === value) ? (value as Sort) : "relevance";
}

export function parseGenres(raw: string): { mode: "all" | "any"; selected: string[] } {
  const value = (raw ?? "").trim();
  if (!value) return { mode: "all", selected: [] };

  const any = value.includes("|");
  const parts = value
    .split(any ? "|" : ",")
    .map((part) => part.trim())
    .filter(Boolean);

  return { mode: any ? "any" : "all", selected: parts };
}

export function buildBaseParams(args: {
  mediaType: MediaType;
  trimmedQuery: string;
  yearFrom: string;
  yearTo: string;
  minRating: string;
  minVotes: string;
  sort: Sort;
  genres: string;
  originCountry: string;
  originalLanguage: string;
}): URLSearchParams {
  const params = new URLSearchParams();
  params.set("media_type", args.mediaType);

  if (args.trimmedQuery) params.set("q", args.trimmedQuery);
  if (args.yearFrom) params.set("year_from", args.yearFrom);
  if (args.yearTo) params.set("year_to", args.yearTo);
  if (args.minRating) params.set("min_rating", args.minRating);
  if (args.minVotes) params.set("min_votes", args.minVotes);
  if (args.sort && args.sort !== "relevance") params.set("sort", args.sort);
  if (args.genres) params.set("genres", args.genres);
  if (args.originCountry) params.set("origin_country", args.originCountry);
  if (args.originalLanguage) params.set("original_language", args.originalLanguage);

  return params;
}

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
