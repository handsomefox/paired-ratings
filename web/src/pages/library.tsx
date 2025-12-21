import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiShow } from "@/lib/api";
import { combinedRating, formatScore, formatVotes, ratingText, shortGenres } from "@/lib/utils";
import { Loading } from "@/components/loading";
import { ViewTransitionLink } from "@/components/view-transition-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const baseStatusOptions = [
  { value: "all", label: "All" },
  { value: "planned", label: "Planned" },
  { value: "watched", label: "Watched" },
];

const anyGenreValue = "__any_genre__";

function statusBadge(status?: string) {
  if (status === "watched") return "bg-teal-500/15 text-teal-300 border-teal-500/40";
  if (status === "planned") return "bg-purple-500/15 text-purple-300 border-purple-500/40";
  return "bg-muted text-muted-foreground";
}

export function LibraryPage() {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const [status, setStatus] = useState(() => initialParams.get("status") ?? "all");
  const [genre, setGenre] = useState(() => initialParams.get("genre") ?? "");
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
  });

  const debouncedFilters = useDebouncedValue(
    { status, genre, yearFrom, yearTo, unrated, sort },
    250,
  );

  const params = useMemo(() => {
    const p = new URLSearchParams();
    if (debouncedFilters.status && debouncedFilters.status !== "all")
      p.set("status", debouncedFilters.status);
    if (debouncedFilters.genre) p.set("genre", debouncedFilters.genre);
    if (debouncedFilters.yearFrom) p.set("year_from", debouncedFilters.yearFrom);
    if (debouncedFilters.yearTo) p.set("year_to", debouncedFilters.yearTo);
    if (debouncedFilters.unrated) p.set("unrated", "1");
    if (debouncedFilters.sort && debouncedFilters.sort !== "updated")
      p.set("sort", debouncedFilters.sort);
    return p;
  }, [
    debouncedFilters.status,
    debouncedFilters.genre,
    debouncedFilters.yearFrom,
    debouncedFilters.yearTo,
    debouncedFilters.unrated,
    debouncedFilters.sort,
  ]);

  const showsQuery = useQuery({
    queryKey: ["shows", params.toString()],
    queryFn: () => api.listShows(params),
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
    debouncedFilters.yearFrom,
    debouncedFilters.yearTo,
    debouncedFilters.unrated,
    debouncedFilters.sort,
  ]);

  const shows = showsQuery.data?.shows ?? [];
  const genres = showsQuery.data?.genres ?? [];
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
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </label>
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
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Genre
          </label>
          <Select
            value={genre || anyGenreValue}
            onValueChange={(value) => setGenre(value === anyGenreValue ? "" : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={anyGenreValue}>Any</SelectItem>
              {genres.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Year from
          </label>
          <Input
            type="number"
            min={1900}
            max={2100}
            value={yearFrom}
            onChange={(event) => setYearFrom(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Year to
          </label>
          <Input
            type="number"
            min={1900}
            max={2100}
            value={yearTo}
            onChange={(event) => setYearTo(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sort
          </label>
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
        </div>
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
          variant="secondary"
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

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="lg:hidden">
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[320px] bg-card text-foreground">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="mt-6">{FiltersForm}</div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-border/60 bg-card/70 p-5 shadow-lg">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Filters
            </div>
            <div className="mt-5">{FiltersForm}</div>
          </div>
        </aside>
        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {showsQuery.isLoading ? <Loading label="Loading..." /> : null}
          {!showsQuery.isLoading && !shows.length ? (
            <div className="col-span-full rounded-2xl border border-dashed border-border/60 bg-card/30 p-12 text-center text-sm text-muted-foreground">
              No shows yet. Use “Add” to pull from TMDB.
            </div>
          ) : null}
          {shows.map((show) => (
            <Card
              key={show.id}
              className="group overflow-hidden border-border/60 bg-card/70 shadow-lg"
            >
              <div className="relative">
                <ViewTransitionLink to="/show/$showId" params={{ showId: String(show.id) }}>
                  <div className="aspect-[2/3] overflow-hidden bg-muted/40">
                    {show.poster_path ? (
                      <img
                        src={`${imageBase}${show.poster_path}`}
                        alt={show.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs uppercase tracking-wide text-muted-foreground">
                        No poster
                      </div>
                    )}
                  </div>
                </ViewTransitionLink>
                <div className="absolute right-3 top-3">
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
                </div>
              </div>
              <CardContent className="space-y-3 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold leading-tight">
                      <ViewTransitionLink to="/show/$showId" params={{ showId: String(show.id) }}>
                        {show.title}
                      </ViewTransitionLink>
                    </h3>
                    {show.year ? (
                      <div className="text-xs text-muted-foreground">{show.year}</div>
                    ) : null}
                  </div>
                  <Badge variant="outline" className={cn("border", statusBadge(show.status))}>
                    {show.status || "tbd"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="secondary" className="gap-1">
                    {show.tmdb_rating ? (
                      <>
                        <span>{formatScore(show.tmdb_rating)}</span>
                        {show.tmdb_votes ? <span>({formatVotes(show.tmdb_votes)})</span> : null}
                      </>
                    ) : (
                      "No TMDB score"
                    )}
                  </Badge>
                  {show.genres ? (
                    <span className="text-muted-foreground">{shortGenres(show.genres)}</span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <div className="inline-flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-teal-200">
                    <span>★</span>
                    <strong>{ratingText(show.bf_rating)}</strong>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-purple-200">
                    <span>★</span>
                    <strong>{ratingText(show.gf_rating)}</strong>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-foreground">
                    <span className="uppercase tracking-wide text-muted-foreground">Avg</span>
                    <strong>{combinedRating(show.bf_rating, show.gf_rating)}</strong>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>

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
    </section>
  );
}
