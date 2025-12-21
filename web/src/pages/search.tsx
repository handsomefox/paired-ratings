import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { SearchResponse, SearchResult } from "@/lib/api";
import { Loading } from "@/components/loading";
import { formatScore, formatVotes, shortGenreList } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useDebouncedValue } from "@/lib/use-debounced-value";

const sortOptions = [
  { value: "relevance", label: "Relevance" },
  { value: "rating", label: "TMDB rating" },
  { value: "votes", label: "TMDB votes" },
  { value: "year", label: "Year" },
  { value: "title", label: "Title" },
];

const mediaTypeOptions = [
  { value: "all", label: "All" },
  { value: "movie", label: "Movie" },
  { value: "tv", label: "TV" },
];

type SearchKey = {
  q: string;
  media_type: string;
  year_from: string;
  year_to: string;
  min_rating: string;
  min_votes: string;
  sort: string;
  genres: string;
};

export function SearchPage() {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);

  const [query, setQuery] = useState(initialParams.get("q") ?? "");
  const [mediaType, setMediaType] = useState(initialParams.get("media_type") ?? "all");
  const [yearFrom, setYearFrom] = useState(initialParams.get("year_from") ?? "");
  const [yearTo, setYearTo] = useState(initialParams.get("year_to") ?? "");
  const [minRating, setMinRating] = useState(initialParams.get("min_rating") ?? "");
  const [minVotes, setMinVotes] = useState(initialParams.get("min_votes") ?? "");
  const [sort, setSort] = useState(initialParams.get("sort") ?? "relevance");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [genreMode, setGenreMode] = useState<"all" | "any">(() =>
    (initialParams.get("genres") ?? "").includes("|") ? "any" : "all",
  );
  const [selectedGenres, setSelectedGenres] = useState<string[]>(() => {
    const raw = initialParams.get("genres") ?? "";
    if (!raw) return [];
    return raw
      .split(raw.includes("|") ? "|" : ",")
      .map((part) => part.trim())
      .filter(Boolean);
  });

  const queryClient = useQueryClient();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: api.session,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });

  const searchGenresQuery = useQuery({
    queryKey: ["search-genres"],
    queryFn: api.searchGenres,
    staleTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const imageBase = sessionQuery.data?.image_base ?? "";

  const genreQuery = useMemo(() => {
    if (!selectedGenres.length) return "";
    return selectedGenres.join(genreMode === "any" ? "|" : ",");
  }, [selectedGenres, genreMode]);

  const debouncedFilters = useDebouncedValue(
    { query, mediaType, yearFrom, yearTo, minRating, minVotes, sort, genres: genreQuery },
    600,
  );

  const trimmedQuery = debouncedFilters.query.trim();

  const hasFilters: boolean =
    debouncedFilters.mediaType !== "all" ||
    debouncedFilters.yearFrom !== "" ||
    debouncedFilters.yearTo !== "" ||
    debouncedFilters.minRating !== "" ||
    debouncedFilters.minVotes !== "" ||
    debouncedFilters.genres !== "" ||
    (debouncedFilters.sort !== "" && debouncedFilters.sort !== "relevance");

  const enabled: boolean = trimmedQuery.length >= 1 || hasFilters;

  const searchKey: SearchKey = useMemo(
    () => ({
      q: trimmedQuery,
      media_type: debouncedFilters.mediaType,
      year_from: debouncedFilters.yearFrom,
      year_to: debouncedFilters.yearTo,
      min_rating: debouncedFilters.minRating,
      min_votes: debouncedFilters.minVotes,
      sort: debouncedFilters.sort,
      genres: debouncedFilters.genres,
    }),
    [
      trimmedQuery,
      debouncedFilters.mediaType,
      debouncedFilters.yearFrom,
      debouncedFilters.yearTo,
      debouncedFilters.minRating,
      debouncedFilters.minVotes,
      debouncedFilters.sort,
      debouncedFilters.genres,
    ],
  );

  useEffect(() => {
    const params = new URLSearchParams();

    if (trimmedQuery) params.set("q", trimmedQuery);
    if (debouncedFilters.mediaType && debouncedFilters.mediaType !== "all") {
      params.set("media_type", debouncedFilters.mediaType);
    }
    if (debouncedFilters.yearFrom) params.set("year_from", debouncedFilters.yearFrom);
    if (debouncedFilters.yearTo) params.set("year_to", debouncedFilters.yearTo);
    if (debouncedFilters.minRating) params.set("min_rating", debouncedFilters.minRating);
    if (debouncedFilters.minVotes) params.set("min_votes", debouncedFilters.minVotes);
    if (debouncedFilters.sort && debouncedFilters.sort !== "relevance") {
      params.set("sort", debouncedFilters.sort);
    }
    if (debouncedFilters.genres) {
      params.set("genres", debouncedFilters.genres);
    }

    const next = params.toString();
    const url = next ? `/search?${next}` : "/search";
    window.history.replaceState(null, "", url);
  }, [
    trimmedQuery,
    debouncedFilters.mediaType,
    debouncedFilters.yearFrom,
    debouncedFilters.yearTo,
    debouncedFilters.minRating,
    debouncedFilters.minVotes,
    debouncedFilters.sort,
    debouncedFilters.genres,
  ]);

  const buildParams = (page: number) => {
    const params = new URLSearchParams();

    if (trimmedQuery) params.set("q", trimmedQuery);
    if (debouncedFilters.mediaType && debouncedFilters.mediaType !== "all") {
      params.set("media_type", debouncedFilters.mediaType);
    }
    if (debouncedFilters.yearFrom) params.set("year_from", debouncedFilters.yearFrom);
    if (debouncedFilters.yearTo) params.set("year_to", debouncedFilters.yearTo);
    if (debouncedFilters.minRating) params.set("min_rating", debouncedFilters.minRating);
    if (debouncedFilters.minVotes) params.set("min_votes", debouncedFilters.minVotes);
    if (debouncedFilters.sort && debouncedFilters.sort !== "relevance") {
      params.set("sort", debouncedFilters.sort);
    }
    if (debouncedFilters.genres) {
      params.set("genres", debouncedFilters.genres);
    }
    if (page > 1) params.set("page", String(page));

    return params;
  };

  const searchQuery = useInfiniteQuery<
    SearchResponse,
    Error,
    InfiniteData<SearchResponse, number>,
    (string | SearchKey)[],
    number
  >({
    queryKey: ["search", searchKey],
    initialPageParam: 1,
    enabled,
    queryFn: ({ pageParam }) => api.search(buildParams(pageParam)),
    getNextPageParam: (lastPage) =>
      lastPage.page < lastPage.total_pages ? lastPage.page + 1 : undefined,

    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });

  const addMutation = useMutation({
    mutationFn: api.addShow,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["shows"] });

      queryClient.setQueryData<InfiniteData<SearchResponse, number>>(
        ["search", searchKey],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              results: page.results.map((item) =>
                item.id === variables.tmdb_id && item.media_type === variables.media_type
                  ? { ...item, in_library: true }
                  : item,
              ),
            })),
          };
        },
      );

      toast.success("Added to library.");
    },
    onError: () => {
      toast.error("Failed to add to library.");
    },
  });

  const results: SearchResult[] =
    searchQuery.data?.pages
      .flatMap((page) => page.results)
      .filter((item): item is SearchResult => Boolean(item)) ?? [];

  const totalResults = searchQuery.data?.pages[0]?.total_results ?? 0;

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = searchQuery;

  useEffect(() => {
    if (searchQuery.isError) toast.error("Failed to load search results.");
  }, [searchQuery.isError]);

  const fetchLockRef = useRef(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!enabled) return;
        if (!hasNextPage) return;
        if (fetchLockRef.current) return;

        fetchLockRef.current = true;
        void fetchNextPage().finally(() => {
          fetchLockRef.current = false;
        });
      },
      { rootMargin: "150px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [enabled, hasNextPage, fetchNextPage]);

  const renderResultsCount = () => {
    if (!trimmedQuery && !hasFilters) return "";
    const loaded = results.length;

    if (trimmedQuery) {
      if (totalResults && totalResults > loaded) {
        return `Results for "${trimmedQuery}" (${loaded} / ${totalResults})`;
      }
      return `Results for "${trimmedQuery}" (${loaded})`;
    }

    if (totalResults && totalResults > loaded) {
      return `Results (${loaded} / ${totalResults})`;
    }
    return `Results (${loaded})`;
  };

  useEffect(() => {
    if (mediaType === "all") {
      setSelectedGenres([]);
    }
  }, [mediaType]);

  const availableGenres =
    mediaType === "movie"
      ? searchGenresQuery.data?.movie_genres ?? []
      : mediaType === "tv"
        ? searchGenresQuery.data?.tv_genres ?? []
        : [];

  const handleAdd = (item: SearchResult, status: string) => {
    addMutation.mutate({
      tmdb_id: item.id,
      media_type: item.media_type,
      status,
    });
  };

  const FiltersForm = (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Type
        </label>
        <Select value={mediaType} onValueChange={setMediaType}>
          <SelectTrigger>
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            {mediaTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
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
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Min TMDB rating
        </label>
        <Input
          type="number"
          min={0}
          max={10}
          step={0.1}
          value={minRating}
          onChange={(event) => setMinRating(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Min reviews
        </label>
        <Input
          type="number"
          min={0}
          max={1000000}
          step={1}
          value={minVotes}
          onChange={(event) => setMinVotes(event.target.value)}
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

      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Genres
        </label>
        {mediaType === "all" ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Choose Movie or TV to filter by genre.
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-border/60 bg-card/60 p-3">
            <Select value={genreMode} onValueChange={(value) => setGenreMode(value as "all" | "any")}>
              <SelectTrigger>
                <SelectValue placeholder="Match" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Match all selected</SelectItem>
                <SelectItem value="any">Match any selected</SelectItem>
              </SelectContent>
            </Select>
            <div className="max-h-48 space-y-2 overflow-y-auto">
              {searchGenresQuery.isLoading ? (
                <div className="text-xs text-muted-foreground">Loading genres…</div>
              ) : null}
              {!searchGenresQuery.isLoading && availableGenres.length === 0 ? (
                <div className="text-xs text-muted-foreground">No genres found.</div>
              ) : null}
              {availableGenres.map((genre) => {
                const id = String(genre.id);
                const checked = selectedGenres.includes(id);
                return (
                  <label key={genre.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-primary"
                      checked={checked}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedGenres((prev) => [...prev, id]);
                        } else {
                          setSelectedGenres((prev) => prev.filter((val) => val !== id));
                        }
                      }}
                    />
                    <span>{genre.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <Separator />
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setMediaType("all");
          setYearFrom("");
          setYearTo("");
          setMinRating("");
          setMinVotes("");
          setSort("relevance");
          setGenreMode("all");
          setSelectedGenres([]);
        }}
      >
        Reset
      </Button>
    </div>
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-end gap-4">
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

        <div className="space-y-4">
          <form
            className="flex justify-center lg:justify-start"
            onSubmit={(event) => event.preventDefault()}
          >
            <Input
              type="text"
              name="q"
              placeholder="Search TMDB"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full max-w-md"
            />
          </form>

          <div className="text-xs text-muted-foreground">{renderResultsCount()}</div>

          {searchQuery.isLoading ? <Loading label="Loading..." /> : null}

          {!searchQuery.isLoading && !results.length && enabled ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-10 text-center text-sm text-muted-foreground">
              No results yet.
            </div>
          ) : null}

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((item) => (
              <Card
                key={`${item.media_type}-${item.id}`}
                className="group overflow-hidden border-border/60 bg-card/70 shadow-lg"
              >
                <div className="aspect-[2/3] overflow-hidden bg-muted/40">
                  {item.poster_path ? (
                    <img
                      src={`${imageBase}${item.poster_path}`}
                      alt={item.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs uppercase tracking-wide text-muted-foreground">
                      No poster
                    </div>
                  )}
                </div>

                <CardContent className="space-y-3 p-3">
                  <div>
                    <div className="text-base font-semibold leading-tight">{item.title}</div>
                    <div className="text-xs text-muted-foreground">{item.year}</div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="secondary">
                      {item.vote_average ? (
                        <>
                          {formatScore(item.vote_average)}
                          {item.vote_count ? ` (${formatVotes(item.vote_count)})` : ""}
                        </>
                      ) : (
                        "No TMDB score"
                      )}
                    </Badge>
                    <Badge variant="outline">
                      {item.media_type === "movie"
                        ? "Movie"
                        : item.media_type === "tv"
                          ? "TV"
                          : item.media_type}
                    </Badge>
                    {item.genres?.length ? (
                      <span className="text-muted-foreground">{shortGenreList(item.genres)}</span>
                    ) : null}
                  </div>

                  <p className="line-clamp-3 text-xs text-muted-foreground">{item.overview}</p>

                  {item.in_library ? (
                    <Badge className="w-fit bg-primary/15 text-primary">In library</Badge>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-teal-500/40 bg-teal-500/10 text-teal-200 hover:bg-teal-500/20"
                        onClick={() => handleAdd(item, "planned")}
                        disabled={addMutation.isPending}
                      >
                        Plan
                      </Button>
                      <Button
                        size="sm"
                        className="border-purple-500/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20"
                        onClick={() => handleAdd(item, "watched")}
                        disabled={addMutation.isPending}
                      >
                        Watched
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div ref={sentinelRef} />

          {isFetchingNextPage ? (
            <div className="text-center text-xs text-muted-foreground">Loading more…</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
