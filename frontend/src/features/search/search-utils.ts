import { sortOptions, type MediaType, type Sort } from "@/features/search/search-constants";
import type { SearchResult } from "@/lib/api";
import { cleanPage, parseSearchString } from "@/lib/search-params";
import { usableYear } from "@/lib/utils";

/** Stable key for a TMDB result. Movie and TV ids can collide. */
export const resultKey = (item: SearchResult) => `${item.media_type}-${item.id}`;

export type GenreMode = "all" | "any";

export function sanitizeMediaType(raw: string | null | undefined): MediaType {
  const value = (raw ?? "").toLowerCase().trim();
  return value === "tv" ? "tv" : "movie";
}

export function sanitizeSort(raw: string | null | undefined): Sort {
  const value = (raw ?? "").toLowerCase().trim();
  return sortOptions.find((option) => option.value === value)?.value ?? "relevance";
}

/** "18,35" matches every listed genre, "18|35" matches any of them. */
export function parseGenres(raw: string | undefined): { mode: GenreMode; selected: string[] } {
  const value = (raw ?? "").trim();
  if (!value) return { mode: "all", selected: [] };

  const any = value.includes("|");
  const parts = value
    .split(any ? "|" : ",")
    .map((part) => part.trim())
    .filter(Boolean);

  return { mode: any ? "any" : "all", selected: parts };
}

export function formatGenres(mode: GenreMode, selected: string[]): string | undefined {
  return selected.length ? selected.join(mode === "any" ? "|" : ",") : undefined;
}

/** A TMDB rating from 0 to 10, or "" for anything else. */
export function cleanRating(raw: string): string {
  const value = raw.trim();
  const rating = Number(value);
  return value && Number.isFinite(rating) && rating >= 0 && rating <= 10 ? value : "";
}

/** A whole, non-negative vote count, or "" for anything else. */
export function cleanVotes(raw: string): string {
  const value = raw.trim();
  return /^\d+$/.test(value) ? String(Number(value)) : "";
}

/**
 * The search page state as it appears in the URL. A default is left out rather
 * than spelled out, so every view has one canonical URL.
 */
export type SearchPageSearch = {
  q?: string;
  media_type?: "tv";
  year_from?: string;
  year_to?: string;
  min_rating?: string;
  min_votes?: string;
  sort?: Exclude<Sort, "relevance">;
  genres?: string;
  // Genre names from "Find similar" on a detail page. The search page swaps
  // them for TMDB genre ids once the genre list loads.
  genre_names?: string;
  origin_country?: string;
  original_language?: string;
  page?: string;
};

const cleanString = (value: unknown, clean: (raw: string) => string) =>
  clean(parseSearchString(value) ?? "") || undefined;

/** Reads the search page state from the URL, dropping values that make no sense. */
export function validateSearchPageSearch(search: Record<string, unknown>): SearchPageSearch {
  const genres = parseGenres(parseSearchString(search.genres));
  const sort = sanitizeSort(parseSearchString(search.sort));
  return {
    q: parseSearchString(search.q),
    media_type: sanitizeMediaType(parseSearchString(search.media_type)) === "tv" ? "tv" : undefined,
    year_from: cleanString(search.year_from, usableYear),
    year_to: cleanString(search.year_to, usableYear),
    min_rating: cleanString(search.min_rating, cleanRating),
    min_votes: cleanString(search.min_votes, cleanVotes),
    sort: sort === "relevance" ? undefined : sort,
    genres: formatGenres(genres.mode, genres.selected),
    genre_names: parseSearchString(search.genre_names),
    origin_country: parseSearchString(search.origin_country)?.toUpperCase(),
    original_language: parseSearchString(search.original_language)?.toLowerCase(),
    page: cleanPage(search.page),
  };
}

/** The query string for GET /api/search. */
export function searchApiParams(search: SearchPageSearch): URLSearchParams {
  const params = new URLSearchParams({ media_type: search.media_type ?? "movie" });
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined && key !== "media_type" && key !== "genre_names") {
      params.set(key, value);
    }
  }
  return params;
}
