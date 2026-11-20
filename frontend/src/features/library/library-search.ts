import { cleanRating } from "@/features/search/search-utils";
import { isShowStatus, type ShowStatus } from "@/lib/status";
import { cleanPage, parseSearchString } from "@/lib/search-params";
import { usableYear } from "@/lib/utils";

export const librarySorts = ["created", "updated", "avg", "bf", "gf", "year", "title"] as const;
export type LibrarySort = (typeof librarySorts)[number];
export const DEFAULT_SORT = "created" satisfies LibrarySort;

/** Which of the two people have rated a show. Leaving it out matches every show. */
export const ratedFilters = ["both", "missing", "missing_bf", "missing_gf"] as const;
export type RatedFilter = (typeof ratedFilters)[number];

export const pageSizes = [20, 50, 100] as const;
export type PageSize = (typeof pageSizes)[number];
export const DEFAULT_PAGE_SIZE = 20 satisfies PageSize;

/**
 * The library filters as they appear in the URL. A default is left out rather
 * than spelled out, so every view has one canonical URL.
 */
export type LibrarySearch = {
  q?: string;
  media_type?: "movie" | "tv";
  status?: ShowStatus;
  genre?: string;
  origin_country?: string;
  year_from?: string;
  year_to?: string;
  min_rating?: string;
  rated?: RatedFilter;
  sort?: Exclude<LibrarySort, typeof DEFAULT_SORT>;
  page?: string;
  page_size?: "50" | "100";
};

/**
 * Reads the library filters from the URL. GET /api/shows answers 400 for a
 * value it does not know, so anything else, for example from an old link,
 * falls back to the default here instead.
 */
export function validateLibrarySearch(search: Record<string, unknown>): LibrarySearch {
  const status = parseSearchString(search.status);
  const sort = parseSearchString(search.sort);
  const pageSize = parseSearchString(search.page_size);
  const yearFrom = usableYear(parseSearchString(search.year_from) ?? "");
  const yearTo = usableYear(parseSearchString(search.year_to) ?? "");
  const mediaType = parseSearchString(search.media_type);
  const rated = parseSearchString(search.rated);
  return {
    q: parseSearchString(search.q)?.trim() || undefined,
    media_type: mediaType === "movie" || mediaType === "tv" ? mediaType : undefined,
    status: isShowStatus(status) ? status : undefined,
    genre: parseSearchString(search.genre),
    origin_country: parseSearchString(search.origin_country)?.toUpperCase(),
    year_from: yearFrom || undefined,
    year_to: yearTo || undefined,
    min_rating: cleanRating(parseSearchString(search.min_rating) ?? "") || undefined,
    // "Unrated only" was a checkbox that wrote unrated=1 before "rated"
    // replaced it, so an old link still applies it.
    rated:
      ratedFilters.find((value) => value === rated) ??
      (parseSearchString(search.unrated) === "1" ? "missing" : undefined),
    sort: librarySorts.find(
      (value): value is Exclude<LibrarySort, typeof DEFAULT_SORT> =>
        value === sort && value !== DEFAULT_SORT,
    ),
    page: cleanPage(search.page),
    page_size: pageSize === "50" || pageSize === "100" ? pageSize : undefined,
  };
}

/** The query string for GET /api/shows. */
export function libraryApiParams(search: LibrarySearch): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (value !== undefined) params.set(key, value);
  }
  return params;
}
