import FiltersPane from "@/components/filters-pane";
import { FiltersPaneContent } from "@/components/filters-pane-content";
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
import { baseStatusOptions, statusBadgeVariant } from "@/features/library/library-utils";
import type { ApiShow } from "@/lib/api";
import { api } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
  const [sort, setSort] = useState(() => initialParams.get("sort") ?? "updated");
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

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedFilters.status && debouncedFilters.status !== "all")
      p.set("status", debouncedFilters.status);
    if (debouncedFilters.genre) p.set("genre", debouncedFilters.genre);
    if (debouncedFilters.originCountry) p.set("origin_country", debouncedFilters.originCountry);
    if (debouncedFilters.yearFrom) p.set("year_from", debouncedFilters.yearFrom);
    if (debouncedFilters.yearTo) p.set("year_to", debouncedFilters.yearTo);
    if (debouncedFilters.unrated) p.set("unrated", "1");
    if (debouncedFilters.sort && debouncedFilters.sort !== "updated")
      p.set("sort", debouncedFilters.sort);
    return p;
  }, [
    debouncedFilters.status,
    debouncedFilters.genre,
    debouncedFilters.originCountry,
    debouncedFilters.yearFrom,
    debouncedFilters.yearTo,
    debouncedFilters.unrated,
    debouncedFilters.sort,
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
    const next = new URLSearchParams();
    if (debouncedFilters.status && debouncedFilters.status !== "all")
      next.set("status", debouncedFilters.status);
    if (debouncedFilters.genre) next.set("genre", debouncedFilters.genre);
    if (debouncedFilters.originCountry) next.set("origin_country", debouncedFilters.originCountry);
    if (debouncedFilters.yearFrom) next.set("year_from", debouncedFilters.yearFrom);
    if (debouncedFilters.yearTo) next.set("year_to", debouncedFilters.yearTo);
    if (debouncedFilters.unrated) next.set("unrated", "1");
    if (debouncedFilters.sort && debouncedFilters.sort !== "updated")
      next.set("sort", debouncedFilters.sort);

    const query = next.toString();
    const url = query ? `/?${query}` : "/";
    window.history.replaceState(null, "", url);
  }, [
    debouncedFilters.status,
    debouncedFilters.genre,
    debouncedFilters.originCountry,
    debouncedFilters.yearFrom,
    debouncedFilters.yearTo,
    debouncedFilters.unrated,
    debouncedFilters.sort,
  ]);

  const shows = showsQuery.data?.shows ?? [];
  const genres = showsQuery.data?.genres ?? [];
  const countries = showsQuery.data?.countries ?? [];
  const countryNames = countriesQuery.data?.countries ?? [];
  const countryLabel = (code: string) =>
    countryNames.find((country) => country.code === code)?.name ?? code;
  const imageBase = sessionQuery.data?.image_base ?? "";
  const bfName = sessionQuery.data?.bf_name ?? "BF";
  const gfName = sessionQuery.data?.gf_name ?? "GF";

  const sortOptions = [
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
    setSort("updated");
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
    return `Shows (${shows.length})`;
  };

  return (
    <>
      <FiltersPane
        filtersOpen={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={FiltersForm}
        headerClassName="flex-wrap items-end gap-4"
      >
        <FiltersPaneContent>
          <div className="text-xs text-muted-foreground sm:text-sm">{renderCount()}</div>

          <LibraryResults
            shows={shows}
            imageBase={imageBase}
            isInitialLoading={isInitialLoading}
            isEmpty={isEmpty}
            onDelete={setPendingDelete}
            statusBadgeVariant={statusBadgeVariant}
            fromLocation={fromLocation}
          />
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
    </>
  );
}
