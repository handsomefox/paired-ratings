import { isShowStatus, type ShowStatus } from "@/lib/status";
import { cleanPage, parseSearchString } from "@/lib/search-params";
import { usableYear } from "@/lib/utils";

export const librarySorts = ["created", "updated", "avg", "bf", "gf", "year", "title"] as const;
export type LibrarySort = (typeof librarySorts)[number];
export const DEFAULT_SORT = "created" satisfies LibrarySort;

export const pageSizes = [20, 50, 100] as const;
export type PageSize = (typeof pageSizes)[number];
export const DEFAULT_PAGE_SIZE = 20 satisfies PageSize;

/**
 * The library filters as they appear in the URL. A default is left out rather
 * than spelled out, so every view has one canonical URL.
 */
export type LibrarySearch = {
  status?: ShowStatus;
  genre?: string;
  origin_country?: string;
  year_from?: string;
  year_to?: string;
  unrated?: "1";
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
  return {
    status: isShowStatus(status) ? status : undefined,
    genre: parseSearchString(search.genre),
    origin_country: parseSearchString(search.origin_country)?.toUpperCase(),
    year_from: yearFrom || undefined,
    year_to: yearTo || undefined,
    unrated: parseSearchString(search.unrated) === "1" ? "1" : undefined,
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
