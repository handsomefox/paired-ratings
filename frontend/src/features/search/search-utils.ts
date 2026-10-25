import { sortOptions, type MediaType, type Sort } from "@/features/search/search-constants";
import type { SearchResult } from "@/lib/api";

/** Stable key for a TMDB result. Movie and TV ids can collide. */
export const resultKey = (item: SearchResult) => `${item.media_type}-${item.id}`;

export function sanitizeMediaType(raw: string | null | undefined): MediaType {
  const value = (raw ?? "").toLowerCase().trim();
  return value === "tv" ? "tv" : "movie";
}

export function sanitizeSort(raw: string | null | undefined): Sort {
  const value = (raw ?? "").toLowerCase().trim();
  return sortOptions.some((option) => option.value === value) ? (value as Sort) : "relevance";
}

export function parseGenres(raw: string | undefined): { mode: "all" | "any"; selected: string[] } {
  const value = (raw ?? "").trim();
  if (!value) return { mode: "all", selected: [] };

  const any = value.includes("|");
  const parts = value
    .split(any ? "|" : ",")
    .map((part) => part.trim())
    .filter(Boolean);

  return { mode: any ? "any" : "all", selected: parts };
}

export function buildSearchParams(args: {
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
  page: number;
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
  if (args.page > 1) params.set("page", String(args.page));

  return params;
}
