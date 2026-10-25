import FiltersPane from "@/components/filters-pane";
import { FiltersPaneContent } from "@/components/filters-pane-content";
import { Paginator } from "@/components/paginator";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { Input } from "@/components/ui/input";
import { SearchFilters } from "@/features/search/search-filters";
import { SearchResults } from "@/features/search/search-results";
import { mediaTypeOptions, type MediaType, type Sort } from "@/features/search/search-constants";
import {
  buildSearchParams,
  parseGenres,
  resultKey,
  sanitizeMediaType,
  sanitizeSort,
} from "@/features/search/search-utils";
import type { SearchResult } from "@/lib/api";
import { api } from "@/lib/api";
import {
  onShowAdded,
  queryKeys,
  useCountries,
  useGenres,
  useLanguages,
  useSession,
} from "@/lib/queries";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { scrollToTop, usableYear } from "@/lib/utils";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

function parsePage(val: string | undefined): number {
  const page = Number.parseInt(val ?? "1", 10);
  return Number.isFinite(page) && page >= 1 ? page : 1;
}

export function SearchPage() {
  const search = useSearch({ from: "/search" });
  const navigate = useNavigate({ from: "/search" });

  const [queryInput, setQueryInput] = useState(() => search.q ?? "");
  const [mediaType, setMediaType] = useState<MediaType>(() => sanitizeMediaType(search.media_type));
  const [yearFrom, setYearFrom] = useState(() => search.year_from ?? "");
  const [yearTo, setYearTo] = useState(() => search.year_to ?? "");
  const [minRating, setMinRating] = useState(() => search.min_rating ?? "");
  const [minVotes, setMinVotes] = useState(() => search.min_votes ?? "");
  const [page, setPage] = useState(() => parsePage(search.page));
  const [originCountry, setOriginCountry] = useState(() =>
    (search.origin_country ?? "").toUpperCase(),
  );
  const [originalLanguage, setOriginalLanguage] = useState(() =>
    (search.original_language ?? "").toLowerCase(),
  );
  const [sort, setSort] = useState<Sort>(() => sanitizeSort(search.sort));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedOverviews, setExpandedOverviews] = useState<Set<string>>(() => new Set());

  useKeyboardInset();

  const [genreMode, setGenreMode] = useState<"all" | "any">(() => parseGenres(search.genres).mode);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    () => parseGenres(search.genres).selected,
  );

  // "genre_names" comes from Find similar on a detail page. It holds names,
  // which are resolved to TMDB genre ids once the genre list loads.
  const [initialGenreNames] = useState(
    () =>
      search.genre_names
        ?.split(",")
        .map((s) => s.trim())
        .filter(Boolean) ?? [],
  );
  // Track whether we've already applied the resolved names (derived state pattern).
  const [resolvedNamesKey, setResolvedNamesKey] = useState("");

  const handleMediaTypeChange = (value: MediaType) => {
    setMediaType(value);
    // Movie and TV genre ids differ, so a selection does not carry over.
    setGenreMode("all");
    setSelectedGenres([]);
  };

  const queryClient = useQueryClient();

  const { imageBase } = useSession();
  const searchGenresQuery = useGenres();
  const availableCountries = useCountries().data?.countries ?? [];
  const availableLanguages = useLanguages().data?.languages ?? [];

  // Derived state: once genres load, resolve "genre_names" URL param to IDs (one-shot).
  const pendingNamesKey =
    initialGenreNames.length && searchGenresQuery.data ? initialGenreNames.join(",") : "";
  if (pendingNamesKey && pendingNamesKey !== resolvedNamesKey) {
    setResolvedNamesKey(pendingNamesKey);
    const list =
      mediaType === "movie"
        ? searchGenresQuery.data!.movie_genres
        : searchGenresQuery.data!.tv_genres;
    const ids = initialGenreNames
      .map((name) => list.find((g) => g.name.toLowerCase() === name.toLowerCase())?.id)
      .filter((id): id is number => id !== undefined)
      .map(String);
    if (ids.length) setSelectedGenres(ids);
  }

  // Typed filters wait until the reader pauses, so typing "2015" sends one TMDB
  // request rather than four. The object stays the same until an input changes,
  // which useDebouncedValue relies on.
  const typed = useMemo(
    () => ({ queryInput, yearFrom, yearTo, minRating, minVotes }),
    [queryInput, yearFrom, yearTo, minRating, minVotes],
  );
  const debouncedTyped = useDebouncedValue(typed, 600);
  const trimmedQuery = debouncedTyped.queryInput.trim();

  const genreQuery = selectedGenres.join(genreMode === "any" ? "|" : ",");

  const baseParams = {
    mediaType,
    trimmedQuery,
    yearFrom: usableYear(debouncedTyped.yearFrom),
    yearTo: usableYear(debouncedTyped.yearTo),
    minRating: debouncedTyped.minRating,
    minVotes: debouncedTyped.minVotes,
    sort,
    genres: genreQuery,
    originCountry,
    originalLanguage,
  };

  // Any filter change starts again at page 1 with every overview collapsed
  // (derived state pattern avoids an effect).
  const filterKey = buildSearchParams({ ...baseParams, page: 1 }).toString();
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
    setExpandedOverviews(new Set());
  }

  const paramsString = buildSearchParams({ ...baseParams, page }).toString();

  const searchQuery = useQuery({
    queryKey: queryKeys.search(paramsString),
    queryFn: ({ signal }) => api.search(new URLSearchParams(paramsString), { signal }),
    staleTime: 30_000,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
  });

  const isInitialLoading = searchQuery.isLoading && !searchQuery.data;
  const activePage = searchQuery.data?.page || page;

  // The URL shows the page the backend actually returned, which can differ
  // from the requested one when it is past the end.
  const urlParamsString = buildSearchParams({ ...baseParams, page: activePage }).toString();
  const fromLocation = urlParamsString ? `/search?${urlParamsString}` : "/search";

  useEffect(() => {
    void navigate({
      search: Object.fromEntries(new URLSearchParams(urlParamsString)),
      replace: true,
      resetScroll: false,
      viewTransition: false,
    });
  }, [urlParamsString, navigate]);

  useEffect(() => {
    if (searchQuery.isError) toast.error("Failed to load search results.");
  }, [searchQuery.isError]);

  const addMutation = useMutation({
    mutationFn: ({ item, status }: { item: SearchResult; status: string }) =>
      api.addShow({ tmdb_id: item.id, media_type: item.media_type, status }),
    onSuccess: (data, { item }) => {
      if (data.show) {
        onShowAdded(queryClient, {
          tmdbId: item.id,
          mediaType: item.media_type,
          libraryId: data.show.id,
        });
      }
      toast.success("Added to library.");
    },
    onError: () => {
      toast.error("Failed to add to library.");
    },
  });

  const results = searchQuery.data?.results ?? [];
  const totalResults = searchQuery.data?.total_results ?? 0;
  const totalPages = searchQuery.data?.total_pages ?? 0;

  const goToPage = (next: number) => {
    if (next === activePage && next === page) return;
    setPage(next);
    setExpandedOverviews(new Set());
    scrollToTop();
  };

  const availableGenres =
    mediaType === "movie"
      ? (searchGenresQuery.data?.movie_genres ?? [])
      : (searchGenresQuery.data?.tv_genres ?? []);

  const handleOpenImdb = async (item: SearchResult) => {
    // Open the tab now, inside the click. A window.open after the await is no
    // longer tied to the gesture, and Safari blocks it as a popup.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      const resolved = await api.searchResolve(item.id, item.media_type);
      const target = resolved.imdb_url || resolved.tmdb_url;
      if (!target) {
        tab?.close();
        toast.error("No external link found.");
        return;
      }
      if (tab) tab.location.href = target;
      else window.open(target, "_blank", "noopener,noreferrer");
    } catch {
      tab?.close();
      toast.error("Failed to open the external page.");
    }
  };

  const toggleOverview = (key: string) => {
    setExpandedOverviews((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderResultsCount = () => {
    if (searchQuery.isLoading) return "";
    const loaded = results.length;
    if (totalResults && totalResults !== loaded) {
      return `Total results ${totalResults}, showing ${loaded}`;
    }
    return `Total results ${loaded}`;
  };

  const handleResetFilters = () => {
    setMediaType("movie");
    setQueryInput("");
    setYearFrom("");
    setYearTo("");
    setMinRating("");
    setMinVotes("");
    setOriginCountry("");
    setOriginalLanguage("");
    setSort("relevance");
    setGenreMode("all");
    setSelectedGenres([]);
    setPage(1);
    setExpandedOverviews(new Set());
  };

  const FiltersForm = (
    <SearchFilters
      genreMode={genreMode}
      onGenreModeChange={setGenreMode}
      selectedGenres={selectedGenres}
      onSelectedGenresChange={setSelectedGenres}
      availableGenres={availableGenres}
      genresLoading={searchGenresQuery.isLoading}
      originCountry={originCountry}
      onOriginCountryChange={setOriginCountry}
      originalLanguage={originalLanguage}
      onOriginalLanguageChange={setOriginalLanguage}
      availableCountries={availableCountries}
      availableLanguages={availableLanguages}
      yearFrom={yearFrom}
      onYearFromChange={setYearFrom}
      yearTo={yearTo}
      onYearToChange={setYearTo}
      minRating={minRating}
      onMinRatingChange={setMinRating}
      minVotes={minVotes}
      onMinVotesChange={setMinVotes}
      sort={sort}
      onSortChange={setSort}
      onReset={handleResetFilters}
    />
  );

  const pendingItem = addMutation.isPending ? addMutation.variables?.item : undefined;

  return (
    <PullToRefresh
      onRefresh={() => queryClient.invalidateQueries({ queryKey: queryKeys.searchAll })}
    >
      <FiltersPane
        filtersOpen={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={FiltersForm}
        headerClassName="flex-wrap items-end gap-4"
      >
        <FiltersPaneContent>
          <form
            role="search"
            className="flex w-full justify-center"
            onSubmit={(event) => event.preventDefault()}
          >
            <Input
              type="search"
              name="q"
              aria-label="Search TMDB"
              placeholder="Search TMDB"
              value={queryInput}
              onChange={(event) => setQueryInput(event.target.value)}
              className="w-full max-w-md md:max-w-lg lg:max-w-xl"
            />
          </form>

          <div className="flex items-center justify-between gap-4">
            <div
              role="group"
              aria-label="Media type"
              className="inline-flex rounded-lg border border-border/60 bg-muted/40 p-1"
            >
              {mediaTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={mediaType === option.value}
                  onClick={() => handleMediaTypeChange(option.value)}
                  className={`cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                    mediaType === option.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="text-xs text-muted-foreground sm:text-sm">{renderResultsCount()}</div>
          </div>

          <SearchResults
            isInitialLoading={isInitialLoading}
            isFetching={searchQuery.isFetching}
            results={results}
            availableLanguages={availableLanguages}
            imageBase={imageBase}
            expandedOverviews={expandedOverviews}
            onToggleOverview={toggleOverview}
            onOpenImdb={(item) => void handleOpenImdb(item)}
            onAdd={(item, status) => addMutation.mutate({ item, status })}
            pendingKey={pendingItem ? resultKey(pendingItem) : undefined}
            fromLocation={fromLocation}
            query={trimmedQuery}
            mediaType={mediaType}
            onSwitchMediaType={handleMediaTypeChange}
          />

          <Paginator totalPages={totalPages} activePage={activePage} onGoToPage={goToPage} />
        </FiltersPaneContent>
      </FiltersPane>
    </PullToRefresh>
  );
}
