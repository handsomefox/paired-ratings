import FiltersPane from "@/components/filters-pane";
import { FiltersPaneContent } from "@/components/filters-pane-content";
import { Paginator } from "@/components/paginator";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { Button } from "@/components/ui/button";
import { LibraryFilters } from "@/features/library/library-filters";
import { LibraryResults } from "@/features/library/library-results";
import { api } from "@/lib/api";
import { listState, queryKeys, useCountries, useSession } from "@/lib/queries";
import { statusFilterOptions } from "@/lib/status";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { scrollToTop, usableYear } from "@/lib/utils";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

function parsePageSize(val: string | undefined): PageSize {
  if (val === "50") return 50;
  if (val === "100") return 100;
  return 20;
}

function parsePage(val: string | undefined): number {
  const page = Number.parseInt(val ?? "1", 10);
  return Number.isFinite(page) && page >= 1 ? page : 1;
}

export function LibraryPage() {
  const search = useSearch({ from: "/" });
  const navigate = useNavigate({ from: "/" });
  const [status, setStatus] = useState(() => search.status ?? "all");
  const [genre, setGenre] = useState(() => search.genre ?? "");
  const [originCountry, setOriginCountry] = useState(() =>
    (search.origin_country ?? "").toUpperCase(),
  );
  const [yearFrom, setYearFrom] = useState(() => search.year_from ?? "");
  const [yearTo, setYearTo] = useState(() => search.year_to ?? "");
  const [unrated, setUnrated] = useState(() => search.unrated === "1");
  const [sort, setSort] = useState(() => search.sort ?? "created");
  const [page, setPage] = useState(() => parsePage(search.page));
  const [pageSize, setPageSize] = useState<PageSize>(() => parsePageSize(search.page_size));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const queryClient = useQueryClient();

  const { imageBase, bfName, gfName } = useSession();
  const countryNames = useCountries().data?.countries ?? [];

  // useDebouncedValue compares by identity, so the object must stay the same
  // until one of the filters changes.
  const filters = useMemo(
    () => ({ status, genre, originCountry, yearFrom, yearTo, unrated, sort }),
    [status, genre, originCountry, yearFrom, yearTo, unrated, sort],
  );
  const debouncedFilters = useDebouncedValue(filters, 250);

  const appliedYearFrom = usableYear(debouncedFilters.yearFrom);
  const appliedYearTo = usableYear(debouncedFilters.yearTo);

  // Reset to page 1 whenever filters change (derived state pattern avoids effect).
  const filterKey = [
    debouncedFilters.status,
    debouncedFilters.genre,
    debouncedFilters.originCountry,
    appliedYearFrom,
    appliedYearTo,
    debouncedFilters.unrated,
    debouncedFilters.sort,
  ].join("|");
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedFilters.status && debouncedFilters.status !== "all")
      p.set("status", debouncedFilters.status);
    if (debouncedFilters.genre) p.set("genre", debouncedFilters.genre);
    if (debouncedFilters.originCountry) p.set("origin_country", debouncedFilters.originCountry);
    if (appliedYearFrom) p.set("year_from", appliedYearFrom);
    if (appliedYearTo) p.set("year_to", appliedYearTo);
    if (debouncedFilters.unrated) p.set("unrated", "1");
    if (debouncedFilters.sort && debouncedFilters.sort !== "created")
      p.set("sort", debouncedFilters.sort);
    if (page > 1) p.set("page", String(page));
    if (pageSize !== 20) p.set("page_size", String(pageSize));
    return p;
  }, [
    debouncedFilters.status,
    debouncedFilters.genre,
    debouncedFilters.originCountry,
    appliedYearFrom,
    appliedYearTo,
    debouncedFilters.unrated,
    debouncedFilters.sort,
    page,
    pageSize,
  ]);
  const paramsString = params.toString();

  const showsQuery = useQuery({
    queryKey: queryKeys.showList(paramsString),
    queryFn: ({ signal }) => api.listShows(params, { signal }),
    placeholderData: keepPreviousData,
  });

  const fromLocation = paramsString ? `/?${paramsString}` : "/";

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

  // Mirror the applied filters into the URL, so a reload or the back button
  // from a detail page restores them.
  useEffect(() => {
    void navigate({
      search: Object.fromEntries(new URLSearchParams(paramsString)),
      replace: true,
      resetScroll: false,
      viewTransition: false,
    });
  }, [paramsString, navigate]);

  const shows = showsQuery.data?.shows ?? [];
  const genres = showsQuery.data?.genres ?? [];
  const countries = showsQuery.data?.countries ?? [];
  const totalCount = showsQuery.data?.total_count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);
  // Deleting the last show on the last page leaves the page number past the end.
  if (showsQuery.isSuccess && totalPages > 0 && page > totalPages) {
    setPage(totalPages);
  }
  const countryLabel = (code: string) =>
    countryNames.find((country) => country.code === code)?.name ?? code;

  const sortOptions = [
    { value: "created", label: "Date added" },
    { value: "updated", label: "Recently updated" },
    { value: "avg", label: "Average rating" },
    { value: "bf", label: `${bfName} rating` },
    { value: "gf", label: `${gfName} rating` },
    { value: "year", label: "Year" },
    { value: "title", label: "Title" },
  ];

  const countryOptions = countries.map((code) => ({ code, name: countryLabel(code) }));

  // Sort and page size are view preferences, not filters, so they neither count
  // towards Reset being available nor get reset by it.
  const activeFilterCount =
    (status !== "all" ? 1 : 0) +
    (genre ? 1 : 0) +
    (originCountry ? 1 : 0) +
    (yearFrom ? 1 : 0) +
    (yearTo ? 1 : 0) +
    (unrated ? 1 : 0);

  const handleResetFilters = () => {
    setStatus("all");
    setGenre("");
    setOriginCountry("");
    setYearFrom("");
    setYearTo("");
    setUnrated(false);
    setPage(1);
  };

  const FiltersForm = (
    <LibraryFilters
      status={status}
      onStatusChange={setStatus}
      genre={genre}
      onGenreChange={setGenre}
      originCountry={originCountry}
      onOriginCountryChange={setOriginCountry}
      yearFrom={yearFrom}
      onYearFromChange={setYearFrom}
      yearTo={yearTo}
      onYearToChange={setYearTo}
      sort={sort}
      onSortChange={setSort}
      unrated={unrated}
      onUnratedChange={setUnrated}
      statusOptions={statusFilterOptions}
      sortOptions={sortOptions}
      genres={genres}
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
      onClick={handleResetFilters}
      disabled={activeFilterCount === 0}
    >
      Reset{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
    </Button>
  );

  const { isInitialLoading, isEmpty, isError } = listState(showsQuery, shows.length);

  const handlePageSizeChange = (size: PageSize) => {
    setPageSize(size);
    setPage(1);
  };

  return (
    <PullToRefresh onRefresh={() => queryClient.invalidateQueries({ queryKey: queryKeys.shows })}>
      <FiltersPane
        filtersOpen={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={FiltersForm}
        headerAction={resetAction}
        headerClassName="flex-wrap items-end gap-4"
      >
        <FiltersPaneContent>
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground sm:text-sm">
              {isInitialLoading ? "" : `Shows (${totalCount})`}
            </div>
            {!isInitialLoading && totalCount > 0 && (
              <div role="group" aria-label="Shows per page" className="flex items-center gap-1">
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={pageSize === size}
                    onClick={() => handlePageSizeChange(size)}
                    className={`cursor-pointer rounded-md px-2 py-0.5 text-xs transition-colors ${
                      pageSize === size
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            )}
          </div>

          <LibraryResults
            shows={shows}
            imageBase={imageBase}
            isInitialLoading={isInitialLoading}
            isEmpty={isEmpty}
            isError={isError}
            hasFilters={activeFilterCount > 0}
            fromLocation={fromLocation}
          />

          <Paginator
            className="pt-2"
            totalPages={totalPages}
            activePage={page}
            onGoToPage={(p) => {
              setPage(p);
              scrollToTop();
            }}
          />
        </FiltersPaneContent>
      </FiltersPane>
    </PullToRefresh>
  );
}
