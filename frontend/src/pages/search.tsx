import { FiltersPane } from "@/components/filters-pane";
import { Paginator } from "@/components/paginator";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { mediaTypeOptions, type MediaType } from "@/features/search/search-constants";
import { SearchFilters } from "@/features/search/search-filters";
import { SearchResults } from "@/features/search/search-results";
import {
  cleanRating,
  cleanVotes,
  formatGenres,
  parseGenres,
  resultKey,
  searchApiParams,
  type SearchPageSearch,
} from "@/features/search/search-utils";
import type { SearchResult } from "@/lib/api";
import { api } from "@/lib/api";
import {
  listState,
  onShowAdded,
  queryKeys,
  useCountries,
  useGenres,
  useLanguages,
  useSession,
} from "@/lib/queries";
import { pageNumber } from "@/lib/search-params";
import { useTypedSearchValue } from "@/lib/use-typed-search-value";
import { scrollToTop, usableYear } from "@/lib/utils";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";

// Each typed filter costs a TMDB request, so wait for a longer pause than the
// library does.
const TYPING_DELAY = 600;

const route = getRouteApi("/authed/search");

export function SearchPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const queryClient = useQueryClient();
  const { imageBase } = useSession();
  const genresQuery = useGenres();
  const availableCountries = useCountries().data?.countries ?? [];
  const availableLanguages = useLanguages().data?.languages ?? [];

  const mediaType: MediaType = search.media_type ?? "movie";
  const genres = parseGenres(search.genres);
  const page = pageNumber(search.page);

  // Every change replaces the history entry, so Back leaves the search rather
  // than stepping through each filter. A filter change starts again at page 1;
  // validateSearch drops the values that are defaults.
  const updateSearch = (patch: Partial<SearchPageSearch>) =>
    navigate({
      search: (prev) => ({ ...prev, page: undefined, ...patch }),
      replace: true,
      resetScroll: false,
      viewTransition: false,
    });

  const typedDelay = { delay: TYPING_DELAY };
  const [queryText, setQueryText] = useTypedSearchValue(
    search.q ?? "",
    (q) => void updateSearch({ q: q || undefined }),
    typedDelay,
  );
  const [yearFromText, setYearFromText] = useTypedSearchValue(
    search.year_from ?? "",
    (year) => void updateSearch({ year_from: year || undefined }),
    { ...typedDelay, clean: usableYear },
  );
  const [yearToText, setYearToText] = useTypedSearchValue(
    search.year_to ?? "",
    (year) => void updateSearch({ year_to: year || undefined }),
    { ...typedDelay, clean: usableYear },
  );
  const [minRatingText, setMinRatingText] = useTypedSearchValue(
    search.min_rating ?? "",
    (rating) => void updateSearch({ min_rating: rating || undefined }),
    { ...typedDelay, clean: cleanRating },
  );
  const [minVotesText, setMinVotesText] = useTypedSearchValue(
    search.min_votes ?? "",
    (votes) => void updateSearch({ min_votes: votes || undefined }),
    { ...typedDelay, clean: cleanVotes },
  );

  // "Find similar" links here with genre names, because the detail page does
  // not know TMDB's genre ids. Swap them for ids once the genre list loads.
  // The search waits meanwhile, so it does not run once without the genres.
  const genreNames = search.genre_names;
  const genreLists = genresQuery.data;
  const genresFailed = genresQuery.isError;
  useEffect(() => {
    if (!genreNames || (!genreLists && !genresFailed)) return;
    const list = mediaType === "movie" ? genreLists?.movie_genres : genreLists?.tv_genres;
    const wanted = new Set(genreNames.split(",").map((name) => name.trim().toLowerCase()));
    const ids = (list ?? [])
      .filter((g) => wanted.has(g.name.toLowerCase()))
      .map((g) => String(g.id));
    void navigate({
      search: (prev) => ({ ...prev, genre_names: undefined, genres: formatGenres("all", ids) }),
      replace: true,
      resetScroll: false,
      viewTransition: false,
    });
  }, [genreNames, genreLists, genresFailed, mediaType, navigate]);

  const paramsString = searchApiParams(search).toString();
  const searchQuery = useQuery({
    queryKey: queryKeys.search(paramsString),
    queryFn: ({ signal }) => api.search(new URLSearchParams(paramsString), { signal }),
    enabled: !genreNames,
    staleTime: 30_000,
    refetchOnReconnect: false,
    placeholderData: keepPreviousData,
  });

  // The backend answers with the last page when asked for one past the end.
  // Show that page in the URL too. Placeholder data belongs to the previous
  // request, so its page number says nothing about this one.
  const returnedPage = searchQuery.isPlaceholderData ? undefined : searchQuery.data?.page;
  useEffect(() => {
    if (returnedPage && returnedPage !== page) {
      void navigate({
        search: (prev) => ({ ...prev, page: returnedPage > 1 ? String(returnedPage) : undefined }),
        replace: true,
        resetScroll: false,
        viewTransition: false,
      });
    }
  }, [returnedPage, page, navigate]);

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
      toast.success(`Added "${item.title}" to library.`);
    },
    onError: () => {
      toast.error("Failed to add to library.");
    },
  });

  const results = searchQuery.data?.results ?? [];
  const totalResults = searchQuery.data?.total_results ?? 0;
  const totalPages = searchQuery.data?.total_pages ?? 0;
  const { isInitialLoading, isEmpty, isError } = listState(searchQuery, results.length);

  const handleMediaTypeChange = (value: MediaType) =>
    // Movie and TV genre ids differ, so a selection does not carry over.
    void updateSearch({ media_type: value === "tv" ? "tv" : undefined, genres: undefined });

  const handleOpenExternal = async (item: SearchResult) => {
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

  const resultsCount = () => {
    if (isInitialLoading) return "";
    if (totalResults && totalResults !== results.length) {
      return `Total results ${totalResults}, showing ${results.length}`;
    }
    return `Total results ${results.length}`;
  };

  // The search text, media type and sort sit outside the pane, so Reset keeps
  // them, as the library keeps its sort. The typed fields count as soon as
  // something is typed, because Reset also clears the text.
  const activeFilterCount = [
    search.genres,
    search.origin_country,
    search.original_language,
    yearFromText.trim(),
    yearToText.trim(),
    minRatingText.trim(),
    minVotesText.trim(),
  ].filter(Boolean).length;

  const handleResetFilters = () =>
    navigate({
      search: (prev) => ({ q: prev.q, media_type: prev.media_type, sort: prev.sort }),
      replace: true,
      resetScroll: false,
      viewTransition: false,
    });

  const resetAction = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={() => void handleResetFilters()}
      disabled={activeFilterCount === 0}
    >
      Reset{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
    </Button>
  );

  const filters = (
    <SearchFilters
      genreMode={genres.mode}
      onGenreModeChange={(mode) =>
        void updateSearch({ genres: formatGenres(mode, genres.selected) })
      }
      selectedGenres={genres.selected}
      onSelectedGenresChange={(selected) =>
        void updateSearch({ genres: formatGenres(genres.mode, selected) })
      }
      availableGenres={
        (mediaType === "movie" ? genreLists?.movie_genres : genreLists?.tv_genres) ?? []
      }
      genresLoading={genresQuery.isLoading}
      originCountry={search.origin_country ?? ""}
      onOriginCountryChange={(code) => void updateSearch({ origin_country: code || undefined })}
      originalLanguage={search.original_language ?? ""}
      onOriginalLanguageChange={(code) =>
        void updateSearch({ original_language: code || undefined })
      }
      availableCountries={availableCountries}
      availableLanguages={availableLanguages}
      yearFrom={yearFromText}
      onYearFromChange={setYearFromText}
      yearTo={yearToText}
      onYearToChange={setYearToText}
      minRating={minRatingText}
      onMinRatingChange={setMinRatingText}
      minVotes={minVotesText}
      onMinVotesChange={setMinVotesText}
      sort={search.sort ?? "relevance"}
      onSortChange={(sort) => void updateSearch({ sort: sort === "relevance" ? undefined : sort })}
    />
  );

  const pendingItem = addMutation.isPending ? addMutation.variables?.item : undefined;

  return (
    <PullToRefresh
      onRefresh={() => queryClient.invalidateQueries({ queryKey: queryKeys.searchAll })}
    >
      <FiltersPane filters={filters} headerAction={resetAction}>
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
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
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
          <div className="text-xs text-muted-foreground sm:text-sm">{resultsCount()}</div>
        </div>

        <SearchResults
          isInitialLoading={isInitialLoading}
          isEmpty={isEmpty}
          isError={isError}
          isFetching={searchQuery.isFetching}
          results={results}
          availableLanguages={availableLanguages}
          imageBase={imageBase}
          onOpenExternal={(item) => void handleOpenExternal(item)}
          onAdd={(item, status) => addMutation.mutate({ item, status })}
          pendingKey={pendingItem ? resultKey(pendingItem) : undefined}
          query={search.q}
          mediaType={mediaType}
          onSwitchMediaType={handleMediaTypeChange}
        />

        <Paginator
          totalPages={totalPages}
          activePage={page}
          onGoToPage={(next) => {
            void updateSearch({ page: next > 1 ? String(next) : undefined });
            scrollToTop();
          }}
        />
      </FiltersPane>
    </PullToRefresh>
  );
}
