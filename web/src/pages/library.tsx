import CardGrid from "@/components/card-grid";
import { CountryCombobox } from "@/components/country-combobox";
import FilterField from "@/components/filter-field";
import FiltersPane from "@/components/filters-pane";
import { FiltersPaneContent } from "@/components/filters-pane-content";
import { GenreCombobox } from "@/components/genre-combobox";
import { LoadingGrid } from "@/components/loading-grid";
import { OriginCountriesChip } from "@/components/origin-countries-chip";
import RatingChips from "@/components/rating-chips";
import { ShowCard } from "@/components/show-card";
import { TmdbRatingBadge } from "@/components/tmdb-rating-badge";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ViewTransitionLink } from "@/components/view-transition-link";
import type { ApiShow } from "@/lib/api";
import { api } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn, shortGenres } from "@/lib/utils";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Film } from "lucide-react";

const baseStatusOptions = [
  { value: "all", label: "All" },
  { value: "planned", label: "Planned" },
  { value: "watched", label: "Watched" },
];

function statusBadge(status?: string) {
  if (status === "watched") return "bg-teal-500/15 text-teal-300 border-teal-500/40";
  if (status === "planned") return "bg-purple-500/15 text-purple-300 border-purple-500/40";
  return "bg-muted text-muted-foreground";
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

  const FiltersForm = (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 [&>*]:min-w-0">
        <FilterField label="Status">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {baseStatusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>

        <FilterField label="Genre">
          <div className="w-full min-w-0">
            <GenreCombobox
              value={genre}
              onValueChange={setGenre}
              genres={genres}
              placeholder="Any"
              anyLabel="Any"
            />
          </div>
        </FilterField>

        <FilterField label="Origin country">
          <div className="w-full min-w-0">
            <CountryCombobox
              value={originCountry}
              onValueChange={setOriginCountry}
              options={countries.map((code) => ({ code, name: countryLabel(code) }))}
              placeholder="Any"
              anyLabel="Any"
            />
          </div>
        </FilterField>

        <div className="grid grid-cols-2 gap-3">
          <FilterField label="Year from">
            <Input
              type="number"
              min={1900}
              max={2100}
              value={yearFrom}
              onChange={(event) => setYearFrom(event.target.value)}
            />
          </FilterField>
          <FilterField label="Year to">
            <Input
              type="number"
              min={1900}
              max={2100}
              value={yearTo}
              onChange={(event) => setYearTo(event.target.value)}
            />
          </FilterField>
        </div>

        <FilterField label="Sort">
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger>
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
        <Checkbox checked={unrated} onCheckedChange={(value) => setUnrated(Boolean(value))} />
        <div>
          <div className="text-sm font-medium">Unrated only</div>
          <div className="text-xs text-muted-foreground">Hide anything with ratings.</div>
        </div>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          Refresh TMDB
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setStatus("all");
            setGenre("");
            setOriginCountry("");
            setYearFrom("");
            setYearTo("");
            setUnrated(false);
            setSort("updated");
          }}
        >
          Reset
        </Button>
      </div>
    </div>
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
          <div className="text-xs text-muted-foreground">{renderCount()}</div>

          {isInitialLoading ? <LoadingGrid /> : null}

          {isEmpty ? (
            <Empty className="border-border/60 bg-card/30">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Film />
                </EmptyMedia>
                <EmptyTitle>No shows yet</EmptyTitle>
                <EmptyDescription>Use “Add” to pull from TMDB.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : null}

          <CardGrid>
            {shows.map((show) => {
              const originCountries = show.origin_country ?? [];
              return (
                <ShowCard
                  key={show.id}
                  title={
                    <ViewTransitionLink to="/show/$showId" params={{ showId: String(show.id) }}>
                      {show.title}
                    </ViewTransitionLink>
                  }
                  year={show.year}
                  posterAlt={show.title}
                  posterPath={show.poster_path}
                  imageBase={imageBase}
                  posterLink={(node) => (
                    <ViewTransitionLink to="/show/$showId" params={{ showId: String(show.id) }}>
                      {node}
                    </ViewTransitionLink>
                  )}
                  topRight={
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full">
                          <span className="sr-only">Open menu</span>
                          <span className="text-lg leading-none">⋯</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setPendingDelete(show)}>
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  }
                  statusBadge={
                    <Badge variant="outline" className={cn("border", statusBadge(show.status))}>
                      {show.status || "tbd"}
                    </Badge>
                  }
                  metaBadges={
                    <>
                      <TmdbRatingBadge
                        rating={show.tmdb_rating}
                        votes={show.tmdb_votes}
                        className="flex w-full justify-center"
                      />
                      <OriginCountriesChip
                        codes={originCountries}
                        className="w-full"
                        badgeClassName="flex w-full justify-center"
                      />
                    </>
                  }
                  footer={
                    <RatingChips bfRating={show.bf_rating} gfRating={show.gf_rating} />
                  }
                  genresText={show.genres ? shortGenres(show.genres) : ""}
                  overview={show.overview}
                />
              );
            })}
          </CardGrid>
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
