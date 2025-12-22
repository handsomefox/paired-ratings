import CardGrid from "@/components/card-grid";
import { CountryCombobox } from "@/components/country-combobox";
import FilterField from "@/components/filter-field";
import FiltersPane from "@/components/filters-pane";
import { FiltersPaneContent } from "@/components/filters-pane-content";
import { LanguageCombobox } from "@/components/language-combobox";
import { LoadingGrid } from "@/components/loading-grid";
import { OriginCountriesChip } from "@/components/origin-countries-chip";
import { ShowCard } from "@/components/show-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import type { SearchResponse, SearchResult } from "@/lib/api";
import { api } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { formatScore, formatVotes, shortGenreList } from "@/lib/utils";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const sortOptions = [
  { value: "relevance", label: "Relevance" },
  { value: "rating", label: "TMDB rating" },
  { value: "votes", label: "TMDB votes" },
  { value: "year", label: "Year" },
  { value: "title", label: "Title" },
] as const;

const mediaTypeOptions = [
  { value: "movie", label: "Movie" },
  { value: "tv", label: "TV" },
] as const;

type MediaType = (typeof mediaTypeOptions)[number]["value"];
type Sort = (typeof sortOptions)[number]["value"];

function sanitizeMediaType(raw: string | null | undefined): MediaType {
  const v = (raw ?? "").toLowerCase().trim();
  return v === "tv" ? "tv" : "movie";
}

function sanitizeSort(raw: string | null | undefined): Sort {
  const v = (raw ?? "").toLowerCase().trim();
  return sortOptions.some((o) => o.value === v) ? (v as Sort) : "relevance";
}

function parseGenres(raw: string): { mode: "all" | "any"; selected: string[] } {
  const value = (raw ?? "").trim();
  if (!value) return { mode: "all", selected: [] };

  const any = value.includes("|");
  const parts = value
    .split(any ? "|" : ",")
    .map((p) => p.trim())
    .filter(Boolean);

  return { mode: any ? "any" : "all", selected: parts };
}

function buildBaseParams(args: {
  mediaType: MediaType;
  trimmedQuery: string;
  yearFrom: string;
  yearTo: string;
  minRating: string;
  minVotes: string;
  sort: Sort;
  genres: string;
  originCountry: string;
  originalLanguage: string;
}): URLSearchParams {
  const p = new URLSearchParams();
  p.set("media_type", args.mediaType);

  if (args.trimmedQuery) p.set("q", args.trimmedQuery);
  if (args.yearFrom) p.set("year_from", args.yearFrom);
  if (args.yearTo) p.set("year_to", args.yearTo);
  if (args.minRating) p.set("min_rating", args.minRating);
  if (args.minVotes) p.set("min_votes", args.minVotes);
  if (args.sort && args.sort !== "relevance") p.set("sort", args.sort);
  if (args.genres) p.set("genres", args.genres);
  if (args.originCountry) p.set("origin_country", args.originCountry);
  if (args.originalLanguage) p.set("original_language", args.originalLanguage);

  return p;
}

export function SearchPage() {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);

  const [queryInput, setQueryInput] = useState(initialParams.get("q") ?? "");
  const [mediaType, setMediaType] = useState<MediaType>(() =>
    sanitizeMediaType(initialParams.get("media_type")),
  );
  const [yearFrom, setYearFrom] = useState(initialParams.get("year_from") ?? "");
  const [yearTo, setYearTo] = useState(initialParams.get("year_to") ?? "");
  const [minRating, setMinRating] = useState(initialParams.get("min_rating") ?? "");
  const [minVotes, setMinVotes] = useState(initialParams.get("min_votes") ?? "");
  const [page, setPage] = useState(() => {
    const raw = Number(initialParams.get("page") ?? "1");
    return Number.isFinite(raw) && raw > 0 ? raw : 1;
  });
  const [originCountry, setOriginCountry] = useState(
    (initialParams.get("origin_country") ?? "").toUpperCase(),
  );
  const [originalLanguage, setOriginalLanguage] = useState(
    (initialParams.get("original_language") ?? "").toLowerCase(),
  );
  const [sort, setSort] = useState<Sort>(() => sanitizeSort(initialParams.get("sort")));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedOverviews, setExpandedOverviews] = useState<Set<string>>(() => new Set());

  const initialGenres = useMemo(
    () => parseGenres(initialParams.get("genres") ?? ""),
    [initialParams],
  );
  const [genreMode, setGenreMode] = useState<"all" | "any">(initialGenres.mode);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(initialGenres.selected);

  const queryClient = useQueryClient();

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

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

  const searchCountriesQuery = useQuery({
    queryKey: ["search-countries"],
    queryFn: api.searchCountries,
    staleTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });

  const searchLanguagesQuery = useQuery({
    queryKey: ["search-languages"],
    queryFn: api.searchLanguages,
    staleTime: 1000 * 60 * 60 * 24,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });

  const imageBase = sessionQuery.data?.image_base ?? "";

  const debouncedQuery = useDebouncedValue(queryInput, 600);
  const trimmedQuery = debouncedQuery.trim();

  const genreQuery = useMemo(() => {
    if (!selectedGenres.length) return "";
    return selectedGenres.join(genreMode === "any" ? "|" : ",");
  }, [selectedGenres, genreMode]);

  const baseParamsString = useMemo(() => {
    return buildBaseParams({
      mediaType,
      trimmedQuery,
      yearFrom,
      yearTo,
      minRating,
      minVotes,
      sort,
      genres: genreQuery,
      originCountry,
      originalLanguage,
    }).toString();
  }, [
    mediaType,
    trimmedQuery,
    yearFrom,
    yearTo,
    minRating,
    minVotes,
    sort,
    genreQuery,
    originCountry,
    originalLanguage,
  ]);

  const fullParamsString = useMemo(() => {
    const p = buildBaseParams({
      mediaType,
      trimmedQuery,
      yearFrom,
      yearTo,
      minRating,
      minVotes,
      sort,
      genres: genreQuery,
      originCountry,
      originalLanguage,
    });
    if (page > 1) p.set("page", String(page));
    return p.toString();
  }, [
    mediaType,
    trimmedQuery,
    yearFrom,
    yearTo,
    minRating,
    minVotes,
    sort,
    genreQuery,
    originCountry,
    originalLanguage,
    page,
  ]);

  // Reset page when filters (excluding page) change
  const prevBaseRef = useRef(baseParamsString);
  useEffect(() => {
    if (prevBaseRef.current !== baseParamsString) {
      prevBaseRef.current = baseParamsString;
      setPage(1);
    }
  }, [baseParamsString]);

  // Clear expanded overviews when query changes or page changes
  useEffect(() => {
    setExpandedOverviews(new Set());
  }, [baseParamsString, page]);

  // URL sync
  useEffect(() => {
    const url = fullParamsString ? `/search?${fullParamsString}` : "/search";
    window.history.replaceState(null, "", url);
  }, [fullParamsString]);

  const searchQuery = useQuery<SearchResponse, Error>({
    queryKey: ["search", fullParamsString],
    queryFn: () => api.search(new URLSearchParams(fullParamsString)),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
    placeholderData: keepPreviousData,
  });

  const isInitialLoading = searchQuery.isLoading && !searchQuery.data;
  const isFetching = searchQuery.isFetching;

  // If backend clamps page, keep state consistent (only after data arrives)
  useEffect(() => {
    if (searchQuery.isPlaceholderData) return;

    const serverPage = searchQuery.data?.page;
    if (serverPage && serverPage !== page) setPage(serverPage);
  }, [searchQuery.data?.page, page]);

  useEffect(() => {
    if (searchQuery.isError) toast.error("Failed to load search results.");
  }, [searchQuery.isError]);

  const addMutation = useMutation({
    mutationFn: api.addShow,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["shows"] });

      queryClient.setQueryData<SearchResponse>(["search", fullParamsString], (old) => {
        if (!old) return old;
        return {
          ...old,
          results: old.results.map((item) =>
            item.id === variables.tmdb_id && item.media_type === variables.media_type
              ? { ...item, in_library: true }
              : item,
          ),
        };
      });

      toast.success("Added to library.");
    },
    onError: () => {
      toast.error("Failed to add to library.");
    },
  });

  const results: SearchResult[] =
    searchQuery.data?.results?.filter((item): item is SearchResult => Boolean(item)) ?? [];

  const totalResults = searchQuery.data?.total_results ?? 0;
  const totalPages = searchQuery.data?.total_pages ?? 0;

  const pageItems = useMemo(() => {
    if (!totalPages || totalPages <= 1) return [];
    return getPageItems(totalPages, page, 3);
  }, [totalPages, page]);

  const goToPage = (next: number) => {
    const clamped = totalPages ? Math.max(1, Math.min(totalPages, next)) : Math.max(1, next);
    if (clamped === page) return;
    setPage(clamped);
    setExpandedOverviews(new Set());
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const didMountRef = useRef(false);
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    setSelectedGenres([]);
    setGenreMode("all");
  }, [mediaType]);

  const availableGenres =
    mediaType === "movie"
      ? (searchGenresQuery.data?.movie_genres ?? [])
      : (searchGenresQuery.data?.tv_genres ?? []);

  const availableCountries = searchCountriesQuery.data?.countries ?? [];
  const availableLanguages = searchLanguagesQuery.data?.languages ?? [];

  const handleAdd = (item: SearchResult, status: string) => {
    addMutation.mutate({
      tmdb_id: item.id,
      media_type: item.media_type,
      status,
    });
  };

  const handleOpenImdb = async (item: SearchResult) => {
    try {
      const resolved = await api.searchResolve(item.id, item.media_type);
      const target = resolved.imdb_url || resolved.tmdb_url;
      if (!target) {
        toast.error("No external link found.");
        return;
      }
      window.open(target, "_blank", "noopener,noreferrer");
    } catch {
      toast.error("Failed to open IMDb.");
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
    const total = totalResults;
    if (total && total !== loaded) return `Total results ${total}, showing ${loaded}`;
    return `Total results ${loaded}`;
  };

  const FiltersForm = (
    <div className="space-y-5">
      <FilterField label="Type">
        <Select value={mediaType} onValueChange={(v) => setMediaType(v as MediaType)}>
          <SelectTrigger>
            <SelectValue placeholder="Movie" />
          </SelectTrigger>
          <SelectContent>
            {mediaTypeOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Genres">
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

          <ScrollArea className="h-48 pr-2">
            <div className="space-y-2">
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
                        if (event.target.checked) setSelectedGenres((prev) => [...prev, id]);
                        else setSelectedGenres((prev) => prev.filter((val) => val !== id));
                      }}
                    />
                    <span>{genre.name}</span>
                  </label>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </FilterField>

      <FilterField label="Origin country">
        <div className="min-w-0 w-full">
          <CountryCombobox
            value={originCountry}
            onValueChange={setOriginCountry}
            options={availableCountries}
            placeholder="Any"
            anyLabel="Any"
          />
        </div>
      </FilterField>

      <FilterField label="Original language">
        <div className="min-w-0 w-full">
          <LanguageCombobox
            value={originalLanguage}
            onValueChange={setOriginalLanguage}
            options={availableLanguages}
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

      <FilterField label="Min TMDB rating">
        <Input
          type="number"
          min={0}
          max={10}
          step={0.1}
          value={minRating}
          onChange={(event) => setMinRating(event.target.value)}
        />
      </FilterField>

      <FilterField label="Min reviews">
        <Input
          type="number"
          min={0}
          max={1000000}
          step={1}
          value={minVotes}
          onChange={(event) => setMinVotes(event.target.value)}
        />
      </FilterField>

      <FilterField label="Sort">
        <Select value={sort} onValueChange={(v) => setSort(v as Sort)}>
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

      <Separator />

      <Button
        type="button"
        variant="ghost"
        onClick={() => {
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
        }}
      >
        Reset
      </Button>
    </div>
  );

  const isLoading = searchQuery.isLoading;

  return (
    <FiltersPane
      filtersOpen={filtersOpen}
      onOpenChange={setFiltersOpen}
      filters={FiltersForm}
      headerClassName="flex-wrap items-end gap-4"
    >
      <FiltersPaneContent>
        <form className="flex w-full justify-center" onSubmit={(event) => event.preventDefault()}>
          <Input
            type="text"
            name="q"
            placeholder="Search TMDB"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            autoFocus
            className="w-full max-w-md"
          />
        </form>

        <div className="text-xs text-muted-foreground">{renderResultsCount()}</div>

        {isLoading ? <LoadingGrid /> : null}

        {!isLoading && !results.length ? (
          <Empty className="border-border/60 bg-card/30">
            <EmptyHeader>
              <EmptyTitle>No results yet</EmptyTitle>
              <EmptyDescription>Try adjusting the filters or search again.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {isInitialLoading ? <LoadingGrid /> : null}
        <CardGrid className={`transition-opacity ${isFetching ? "opacity-60" : "opacity-100"}`}>
          {results.map((item) => {
            const originCountries = item.origin_country ?? [];
            return (
              <ShowCard
                key={`${item.media_type}-${item.id}`}
                title={item.title}
                year={item.year}
                posterAlt={item.title}
                posterPath={item.poster_path}
                imageBase={imageBase}
                posterLink={(node) => (
                  <button
                    type="button"
                    className="block w-full cursor-pointer text-left"
                    onClick={() => void handleOpenImdb(item)}
                    aria-label={`Search IMDb for ${item.title}`}
                  >
                    {node}
                  </button>
                )}
                metaBadges={
                  <>
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
                    <OriginCountriesChip codes={originCountries} />
                    <Badge variant="outline">
                      {item.media_type === "movie"
                        ? "Movie"
                        : item.media_type === "tv"
                          ? "TV"
                          : item.media_type}
                    </Badge>
                  </>
                }
                genresText={item.genres?.length ? shortGenreList(item.genres) : ""}
                overview={item.overview}
                overviewExpanded={expandedOverviews.has(`${item.media_type}-${item.id}`)}
                onToggleOverview={() => toggleOverview(`${item.media_type}-${item.id}`)}
                footer={
                  item.in_library ? (
                    <Badge className="w-fit bg-primary/15 text-primary">In library</Badge>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-purple-500/40 bg-purple-500/10 text-purple-200 hover:bg-purple-500/20"
                        onClick={() => handleAdd(item, "planned")}
                        disabled={addMutation.isPending}
                      >
                        Plan
                      </Button>
                      <Button
                        size="sm"
                        className="border-teal-500/40 bg-teal-500/10 text-teal-200 hover:bg-teal-500/20"
                        onClick={() => handleAdd(item, "watched")}
                        disabled={addMutation.isPending}
                      >
                        Watched
                      </Button>
                    </div>
                  )
                }
              />
            );
          })}
        </CardGrid>

        {totalPages > 1 ? (
          <Pagination className="pt-6">
            <PaginationContent className="flex-wrap justify-center">
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                  onClick={(event) => {
                    event.preventDefault();
                    goToPage(page - 1);
                  }}
                />
              </PaginationItem>

              {pageItems.map((item, index) => (
                <PaginationItem key={`${item}-${index}`}>
                  {item === "ellipsis" ? (
                    <PaginationEllipsis />
                  ) : (
                    <PaginationLink
                      href="#"
                      isActive={item === page}
                      onClick={(event) => {
                        event.preventDefault();
                        goToPage(item);
                      }}
                    >
                      {item}
                    </PaginationLink>
                  )}
                </PaginationItem>
              ))}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                  onClick={(event) => {
                    event.preventDefault();
                    goToPage(page + 1);
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        ) : null}
      </FiltersPaneContent>
    </FiltersPane>
  );
}

function getPageItems(
  totalPages: number,
  currentPage: number,
  siblingCount = 2,
  boundaryCount = 1,
): Array<number | "ellipsis"> {
  const clamp = (n: number) => Math.max(1, Math.min(totalPages, n));

  const startPages = Array.from({ length: Math.min(boundaryCount, totalPages) }, (_, i) => i + 1);
  const endPages = Array.from(
    { length: Math.min(boundaryCount, totalPages) },
    (_, i) => totalPages - (Math.min(boundaryCount, totalPages) - 1) + i,
  );

  const siblingsStart = clamp(currentPage - siblingCount);
  const siblingsEnd = clamp(currentPage + siblingCount);

  const innerStart = Math.max(siblingsStart, boundaryCount + 1);
  const innerEnd = Math.min(siblingsEnd, totalPages - boundaryCount);

  const items: Array<number | "ellipsis"> = [];

  startPages.forEach((p) => items.push(p));

  if (innerStart > boundaryCount + 1) items.push("ellipsis");
  for (let p = innerStart; p <= innerEnd; p++) items.push(p);

  if (innerEnd < totalPages - boundaryCount) items.push("ellipsis");

  endPages.forEach((p) => {
    if (!items.includes(p)) items.push(p);
  });

  return items;
}
