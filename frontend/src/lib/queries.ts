import {
  api,
  ApiError,
  type GetRelatedResponse,
  type SearchResponse,
  type SearchResult,
} from "@/lib/api";
import { queryOptions, useQuery, type QueryClient } from "@tanstack/react-query";

// Every query key in one place, so invalidation cannot miss a spelling or mix
// a string id with a numeric one.
export const queryKeys = {
  session: ["session"] as const,
  shows: ["shows"] as const,
  showList: (params: string) => ["shows", params] as const,
  show: (id: number) => ["show", id] as const,
  episodes: (id: number) => ["episodes", id] as const,
  relatedAll: ["related"] as const,
  related: (id: number) => ["related", id] as const,
  searchAll: ["search"] as const,
  search: (params: string) => ["search", params] as const,
  searchGenres: ["search-genres"] as const,
  searchCountries: ["search-countries"] as const,
  searchLanguages: ["search-languages"] as const,
};

// Retry once, but only for failures that a retry can fix. A 4xx answer will
// not change on the second attempt.
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 1;
}

export const sessionQueryOptions = queryOptions({
  queryKey: queryKeys.session,
  queryFn: ({ signal }) => api.session({ signal }),
  staleTime: 60_000,
  refetchOnReconnect: false,
  refetchOnMount: false,
});

export function useSession() {
  const query = useQuery(sessionQueryOptions);
  return {
    ...query,
    imageBase: query.data?.image_base ?? "",
    bfName: query.data?.bf_name ?? "BF",
    gfName: query.data?.gf_name ?? "GF",
  };
}

// TMDB reference lists change rarely, so they are fetched once a day at most.
const REFERENCE_STALE_TIME = 1000 * 60 * 60 * 24;

export function useCountries() {
  return useQuery({
    queryKey: queryKeys.searchCountries,
    queryFn: ({ signal }) => api.searchCountries({ signal }),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useLanguages() {
  return useQuery({
    queryKey: queryKeys.searchLanguages,
    queryFn: ({ signal }) => api.searchLanguages({ signal }),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useGenres() {
  return useQuery({
    queryKey: queryKeys.searchGenres,
    queryFn: ({ signal }) => api.searchGenres({ signal }),
    staleTime: REFERENCE_STALE_TIME,
  });
}

type ResultsPage = SearchResponse | GetRelatedResponse;

// Search and related pages carry library_id for titles already in the library.
// Patch every cached page in place so a card flips to "In library" (or back)
// without refetching TMDB.
function setLibraryId(
  queryClient: QueryClient,
  matches: (item: SearchResult) => boolean,
  libraryId: number | undefined,
) {
  const update = <T extends ResultsPage>(old: T | undefined): T | undefined => {
    if (!old) return old;
    return {
      ...old,
      results: old.results.map((item) =>
        matches(item) ? { ...item, library_id: libraryId } : item,
      ),
    };
  };
  queryClient.setQueriesData<SearchResponse>({ queryKey: queryKeys.searchAll }, update);
  queryClient.setQueriesData<GetRelatedResponse>({ queryKey: queryKeys.relatedAll }, update);
}

/** Call after a title is added to the library. */
export function onShowAdded(
  queryClient: QueryClient,
  added: { tmdbId: number; mediaType: string; libraryId: number },
) {
  setLibraryId(
    queryClient,
    (item) => item.id === added.tmdbId && item.media_type === added.mediaType,
    added.libraryId,
  );
  void queryClient.invalidateQueries({ queryKey: queryKeys.shows });
}

/** Call after a show is deleted from the library. */
export function onShowDeleted(queryClient: QueryClient, id: number) {
  setLibraryId(queryClient, (item) => item.library_id === id, undefined);
  queryClient.removeQueries({ queryKey: queryKeys.show(id) });
  queryClient.removeQueries({ queryKey: queryKeys.episodes(id) });
  queryClient.removeQueries({ queryKey: queryKeys.related(id) });
  void queryClient.invalidateQueries({ queryKey: queryKeys.shows });
}

/**
 * Loading and empty flags for a list query. With keepPreviousData a list keeps
 * its old rows while refetching, so "empty" waits until no fetch is running.
 */
export function listState(
  query: { isLoading: boolean; isFetching: boolean; isError: boolean },
  count: number,
) {
  const isInitialLoading = query.isLoading || (query.isFetching && count === 0);
  const isError = query.isError && count === 0 && !query.isFetching;
  const isEmpty = !query.isLoading && !query.isFetching && !query.isError && count === 0;
  return { isInitialLoading, isEmpty, isError };
}
