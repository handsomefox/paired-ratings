import FiltersPane from "@/components/filters-pane";
import { FiltersPaneContent } from "@/components/filters-pane-content";
import { PullToRefresh } from "@/components/pull-to-refresh";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LibraryFilters } from "@/features/library/library-filters";
import { LibraryResults } from "@/features/library/library-results";
import { baseStatusOptions } from "@/features/library/library-utils";
import type { ApiShow } from "@/lib/api";
import { api } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

function Pagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
}) {
  const pages: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else if (page <= 4) {
    pages.push(1, 2, 3, 4, 5, "…", totalPages);
  } else if (page >= totalPages - 3) {
    pages.push(1, "…", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
  } else {
    pages.push(1, "…", page - 1, page, page + 1, "…", totalPages);
  }

  const btn = (label: string | number, target: number, active = false, disabled = false) => (
    <button
      key={`${label}-${target}`}
      onClick={() => !disabled && onPageChange(target)}
      disabled={disabled}
      className={`min-w-[2rem] rounded-md px-2 py-1 text-xs transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : disabled
            ? "cursor-default text-muted-foreground/40"
            : "cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex items-center justify-center gap-1 pt-2">
      {btn("←", page - 1, false, page === 1)}
      {pages.map((p, i) =>
        p === "…" ? (
          <span key={`ellipsis-${i}`} className="px-1 text-xs text-muted-foreground/40">
            …
          </span>
        ) : (
          btn(p, p, p === page)
        ),
      )}
      {btn("→", page + 1, false, page === totalPages)}
    </div>
  );
}

function parsePageSize(val: string | null): PageSize {
  if (val === "50") return 50;
  if (val === "100") return 100;
  return 20;
}

export function LibraryPage() {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [status, setStatus] = useState(() => initialParams.get("status") ?? "all");
  const [genre, setGenre] = useState(() => initialParams.get("genre") ?? "");
  const [originCountry, setOriginCountry] = useState(() =>
    (initialParams.get("origin_country") ?? "").toUpperCase(),
  );
  const [yearFrom, setYearFrom] = useState(() => initialParams.get("year_from") ?? "");
  const [yearTo, setYearTo] = useState(() => initialParams.get("year_to") ?? "");
  const [unrated, setUnrated] = useState(() => initialParams.get("unrated") === "1");
  const [sort, setSort] = useState(() => initialParams.get("sort") ?? "created");
  const [page, setPage] = useState(() => {
    const v = parseInt(initialParams.get("page") ?? "1", 10);
    return Number.isFinite(v) && v >= 1 ? v : 1;
  });
  const [pageSize, setPageSize] = useState<PageSize>(() =>
    parsePageSize(initialParams.get("page_size")),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ApiShow | null>(null);
  const queryClient = useQueryClient();

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: api.session,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });

  const countriesQuery = useQuery({
    queryKey: ["search-countries"],
    queryFn: api.searchCountries,
    staleTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });

  const debouncedFilters = useDebouncedValue(
    { status, genre, originCountry, yearFrom, yearTo, unrated, sort },
    250,
  );

  // Reset to page 1 whenever filters change (derived state pattern avoids effect).
  const filterKey = [
    debouncedFilters.status,
    debouncedFilters.genre,
    debouncedFilters.originCountry,
    debouncedFilters.yearFrom,
    debouncedFilters.yearTo,
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
    if (debouncedFilters.yearFrom) p.set("year_from", debouncedFilters.yearFrom);
    if (debouncedFilters.yearTo) p.set("year_to", debouncedFilters.yearTo);
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
    debouncedFilters.yearFrom,
    debouncedFilters.yearTo,
    debouncedFilters.unrated,
    debouncedFilters.sort,
    page,
    pageSize,
  ]);

  const showsQuery = useQuery({
    queryKey: ["shows", params.toString()],
    queryFn: () => api.listShows(params),
    placeholderData: keepPreviousData,
  });

  const fromLocation = useMemo(() => {
    const query = params.toString();
    return query ? `/?${query}` : "/";
  }, [params]);

  const refreshMutation = useMutation({
    mutationFn: api.refreshTMDB,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast.success("TMDB refreshed.");
    },
    onError: () => {
      toast.error("Failed to refresh TMDB.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteShow(id),
    onSuccess: () => {
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast.success("Show deleted.");
    },
    onError: () => {
      toast.error("Failed to delete show.");
    },
  });

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFiltersOpen(false);
        setPendingDelete(null);
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  useEffect(() => {
    const next = params;
    const query = next.toString();
    const url = query ? `/?${query}` : "/";
    window.history.replaceState(null, "", url);
  }, [params]);

  const shows = showsQuery.data?.shows ?? [];
  const genres = showsQuery.data?.genres ?? [];
  const countries = showsQuery.data?.countries ?? [];
  const totalCount = showsQuery.data?.total_count ?? 0;
  const totalPages = pageSize > 0 ? Math.ceil(totalCount / pageSize) : 1;
  const countryNames = countriesQuery.data?.countries ?? [];
  const countryLabel = (code: string) =>
    countryNames.find((country) => country.code === code)?.name ?? code;
  const imageBase = sessionQuery.data?.image_base ?? "";
  const bfName = sessionQuery.data?.bf_name ?? "BF";
  const gfName = sessionQuery.data?.gf_name ?? "GF";

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

  const handleResetFilters = () => {
    setStatus("all");
    setGenre("");
    setOriginCountry("");
    setYearFrom("");
    setYearTo("");
    setUnrated(false);
    setSort("created");
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
      statusOptions={baseStatusOptions}
      sortOptions={sortOptions}
      genres={genres}
      countries={countryOptions}
      onRefresh={() => refreshMutation.mutate()}
      refreshPending={refreshMutation.isPending}
      onReset={handleResetFilters}
    />
  );

  const isInitialLoading = showsQuery.isLoading || (showsQuery.isFetching && shows.length === 0);
  const isEmpty = !showsQuery.isLoading && !showsQuery.isFetching && shows.length === 0;

  const renderCount = () => {
    if (isInitialLoading) return "";
    return `Shows (${totalCount})`;
  };

  const handlePageSizeChange = (size: PageSize) => {
    setPageSize(size);
    setPage(1);
  };

  return (
    <PullToRefresh onRefresh={() => queryClient.invalidateQueries({ queryKey: ["shows"] })}>
      <FiltersPane
        filtersOpen={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={FiltersForm}
        headerClassName="flex-wrap items-end gap-4"
      >
        <FiltersPaneContent>
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground sm:text-sm">{renderCount()}</div>
            {!isInitialLoading && totalCount > 0 && (
              <div className="flex items-center gap-1">
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    onClick={() => handlePageSizeChange(size)}
                    className={`cursor-pointer rounded px-2 py-0.5 text-xs transition-colors ${
                      pageSize === size
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground"
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
            onDelete={setPendingDelete}
            fromLocation={fromLocation}
          />

          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={(p) => {
                setPage(p);
                window.scrollTo({ top: 0, behavior: "instant" });
              }}
            />
          )}
        </FiltersPaneContent>
      </FiltersPane>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete show?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove “{pendingDelete?.title}” from your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PullToRefresh>
  );
}
