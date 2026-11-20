import { FiltersPane } from "@/components/filters-pane";
import { MediaTypeToggle } from "@/components/media-type-toggle";
import { Paginator } from "@/components/paginator";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LibraryFilters } from "@/features/library/library-filters";
import { LibraryResults } from "@/features/library/library-results";
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  libraryApiParams,
  type LibrarySearch,
  type LibrarySort,
  type PageSize,
  type RatedFilter,
} from "@/features/library/library-search";
import { cleanRating } from "@/features/search/search-utils";
import { api } from "@/lib/api";
import { listState, queryKeys, useCountryName, useSession } from "@/lib/queries";
import { pageNumber } from "@/lib/search-params";
import { useTypedSearchValue } from "@/lib/use-typed-search-value";
import { scrollToTop, usableYear } from "@/lib/utils";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";

const TYPING_DELAY = 250;

const mediaTypeOptions = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movies" },
  { value: "tv", label: "TV Shows" },
] as const;

const route = getRouteApi("/authed/");

export function LibraryPage() {
  const search = route.useSearch();
  const navigate = route.useNavigate();
  const queryClient = useQueryClient();
  const { imageBase, bfName, gfName } = useSession();
  const countryName = useCountryName();

  const page = pageNumber(search.page);
  const pageSize = search.page_size ? (Number(search.page_size) as PageSize) : DEFAULT_PAGE_SIZE;

  // Every change replaces the history entry, so Back leaves the library
  // rather than stepping through each filter. A filter change starts again at
  // page 1; validateSearch drops the values that are defaults.
  const updateSearch = (patch: Partial<LibrarySearch>) =>
    navigate({
      search: (prev) => ({ ...prev, page: undefined, ...patch }),
      replace: true,
      resetScroll: false,
      viewTransition: false,
    });

  const [queryText, setQueryText] = useTypedSearchValue(
    search.q ?? "",
    (value) => void updateSearch({ q: value || undefined }),
    { delay: TYPING_DELAY },
  );
  const [yearFrom, setYearFrom] = useTypedSearchValue(
    search.year_from ?? "",
    (value) => void updateSearch({ year_from: value || undefined }),
    { delay: TYPING_DELAY, clean: usableYear },
  );
  const [yearTo, setYearTo] = useTypedSearchValue(
    search.year_to ?? "",
    (value) => void updateSearch({ year_to: value || undefined }),
    { delay: TYPING_DELAY, clean: usableYear },
  );
  const [minRating, setMinRating] = useTypedSearchValue(
    search.min_rating ?? "",
    (value) => void updateSearch({ min_rating: value || undefined }),
    { delay: TYPING_DELAY, clean: cleanRating },
  );

  const paramsString = libraryApiParams(search).toString();
  const showsQuery = useQuery({
    queryKey: queryKeys.showList(paramsString),
    queryFn: ({ signal }) => api.listShows(new URLSearchParams(paramsString), { signal }),
    placeholderData: keepPreviousData,
  });

  const refreshMutation = useMutation({
    mutationFn: api.refreshTMDB,
    onSuccess: ({ updated, failed }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.shows });
      if (updated === 0 && failed === 0) {
        toast.success("Everything is up to date.");
        return;
      }
      const refreshed = `Refreshed ${updated} ${updated === 1 ? "show" : "shows"}.`;
      if (failed > 0) {
        toast.warning(`${refreshed} ${failed} could not be reached.`);
        return;
      }
      toast.success(refreshed);
    },
    onError: () => {
      toast.error("Failed to refresh TMDB.");
    },
  });

  const shows = showsQuery.data?.shows ?? [];
  const totalCount = showsQuery.data?.total_count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Deleting the last show on the last page leaves the page number past the
  // end. Placeholder data belongs to the previous filters, so it cannot tell.
  const pastEnd =
    showsQuery.isSuccess && !showsQuery.isPlaceholderData && page > Math.max(totalPages, 1);
  useEffect(() => {
    if (pastEnd) {
      void navigate({
        search: (prev) => ({ ...prev, page: totalPages > 1 ? String(totalPages) : undefined }),
        replace: true,
        resetScroll: false,
        viewTransition: false,
      });
    }
  }, [pastEnd, totalPages, navigate]);

  const sortOptions: Array<{ value: LibrarySort; label: string }> = [
    { value: "created", label: "Date added" },
    { value: "updated", label: "Recently updated" },
    { value: "avg", label: "Average rating" },
    { value: "bf", label: `${bfName} rating` },
    { value: "gf", label: `${gfName} rating` },
    { value: "year", label: "Year" },
    { value: "title", label: "Title" },
  ];

  const ratedOptions: Array<{ value: RatedFilter | "any"; label: string }> = [
    { value: "any", label: "Any" },
    { value: "both", label: "Rated by both" },
    { value: "missing", label: "Missing a rating" },
    { value: "missing_bf", label: `Not rated by ${bfName}` },
    { value: "missing_gf", label: `Not rated by ${gfName}` },
  ];

  const countryOptions = (showsQuery.data?.countries ?? []).map((code) => ({
    code,
    name: countryName(code),
  }));

  // Sort and page size are view preferences, not filters, so they neither count
  // towards Reset being available nor get reset by it. The search text and the
  // media type sit outside the pane, as on the search page, so Reset keeps
  // them too. The typed fields count as soon as something is typed, because
  // Reset also clears the text.
  const activeFilterCount = [
    search.status,
    search.rated,
    search.genre,
    search.origin_country,
    yearFrom.trim(),
    yearTo.trim(),
    minRating.trim(),
  ].filter(Boolean).length;

  const handleResetFilters = () =>
    navigate({
      search: {
        q: search.q,
        media_type: search.media_type,
        sort: search.sort,
        page_size: search.page_size,
      },
      replace: true,
      resetScroll: false,
      viewTransition: false,
    });

  const filters = (
    <LibraryFilters
      status={search.status ?? "all"}
      onStatusChange={(status) =>
        void updateSearch({ status: status === "all" ? undefined : status })
      }
      genre={search.genre ?? ""}
      onGenreChange={(genre) => void updateSearch({ genre: genre || undefined })}
      originCountry={search.origin_country ?? ""}
      onOriginCountryChange={(code) => void updateSearch({ origin_country: code || undefined })}
      yearFrom={yearFrom}
      onYearFromChange={setYearFrom}
      yearTo={yearTo}
      onYearToChange={setYearTo}
      minRating={minRating}
      onMinRatingChange={setMinRating}
      rated={search.rated ?? "any"}
      onRatedChange={(rated) => void updateSearch({ rated: rated === "any" ? undefined : rated })}
      ratedOptions={ratedOptions}
      sort={search.sort ?? DEFAULT_SORT}
      onSortChange={(sort) => void updateSearch({ sort: sort === DEFAULT_SORT ? undefined : sort })}
      pageSize={pageSize}
      onPageSizeChange={(size) =>
        void updateSearch({
          page_size: size === DEFAULT_PAGE_SIZE ? undefined : (String(size) as "50" | "100"),
        })
      }
      sortOptions={sortOptions}
      genres={showsQuery.data?.genres ?? []}
      countries={countryOptions}
      onRefresh={() => refreshMutation.mutate()}
      refreshPending={refreshMutation.isPending}
    />
  );

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

  const { isInitialLoading, isEmpty, isError } = listState(showsQuery, shows.length);

  const toolbar = (
    <form
      role="search"
      className="flex w-full justify-center"
      onSubmit={(event) => event.preventDefault()}
    >
      <Input
        type="search"
        name="q"
        aria-label="Search the library"
        placeholder="Search the library"
        enterKeyHint="search"
        value={queryText}
        onChange={(event) => setQueryText(event.target.value)}
        className="w-full lg:max-w-xl"
      />
    </form>
  );

  return (
    <PullToRefresh onRefresh={() => queryClient.invalidateQueries({ queryKey: queryKeys.shows })}>
      <FiltersPane
        filters={filters}
        headerAction={resetAction}
        activeCount={activeFilterCount}
        toolbar={toolbar}
      >
        {/* The same row as on the search page, so the cards line up on both. */}
        <div className="flex items-center justify-between gap-4">
          <MediaTypeToggle
            options={mediaTypeOptions}
            value={search.media_type ?? "all"}
            onChange={(value) =>
              void updateSearch({ media_type: value === "all" ? undefined : value })
            }
          />
          <div className="text-right text-sm text-muted-foreground">
            {isInitialLoading ? "" : `${totalCount} ${totalCount === 1 ? "show" : "shows"}`}
          </div>
        </div>

        <LibraryResults
          shows={shows}
          imageBase={imageBase}
          bfName={bfName}
          gfName={gfName}
          isInitialLoading={isInitialLoading}
          isEmpty={isEmpty}
          isError={isError}
          hasFilters={activeFilterCount > 0 || Boolean(search.q || search.media_type)}
        />

        <Paginator
          className="pt-2"
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
