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
import type { SearchRequest, SearchResponse, SearchResult } from "@/lib/api";
import { api } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { formatScore, formatVotes, shortGenreList } from "@/lib/utils";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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

type SearchKey = Omit<SearchRequest, "page">;

export function SearchPage() {
  const initialParams = useMemo(() => new URLSearchParams(window.location.search), []);

  const [query, setQuery] = useState(initialParams.get("q") ?? "");
  const [mediaType, setMediaType] = useState(initialParams.get("media_type") ?? "all");
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
  const [sort, setSort] = useState(initialParams.get("sort") ?? "relevance");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedOverviews, setExpandedOverviews] = useState<Set<string>>(() => new Set());
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
    {
      query,
      mediaType,
      yearFrom,
      yearTo,
      minRating,
      minVotes,
      sort,
      genres: genreQuery,
      originCountry,
      originalLanguage,
    },
    600,
  );

  useEffect(() => {
    setPage((prev) => (prev === 1 ? prev : 1));
  }, [
    debouncedFilters.query,
    debouncedFilters.mediaType,
    debouncedFilters.yearFrom,
    debouncedFilters.yearTo,
    debouncedFilters.minRating,
    debouncedFilters.minVotes,
    debouncedFilters.sort,
    debouncedFilters.genres,
    debouncedFilters.originCountry,
    debouncedFilters.originalLanguage,
  ]);

  const trimmedQuery = debouncedFilters.query.trim();

  const hasFilters: boolean =
    debouncedFilters.mediaType !== "all" ||
    debouncedFilters.yearFrom !== "" ||
    debouncedFilters.yearTo !== "" ||
    debouncedFilters.minRating !== "" ||
    debouncedFilters.minVotes !== "" ||
    debouncedFilters.genres !== "" ||
    debouncedFilters.originCountry !== "" ||
    debouncedFilters.originalLanguage !== "" ||
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
      origin_country: debouncedFilters.originCountry,
      original_language: debouncedFilters.originalLanguage,
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
      debouncedFilters.originCountry,
      debouncedFilters.originalLanguage,
    ],
  );

  useEffect(() => {
    setExpandedOverviews(new Set());
  }, [
    searchKey.q,
    searchKey.media_type,
    searchKey.year_from,
    searchKey.year_to,
    searchKey.min_rating,
    searchKey.min_votes,
    searchKey.sort,
    searchKey.genres,
    page,
  ]);

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
    if (debouncedFilters.originCountry) {
      params.set("origin_country", debouncedFilters.originCountry);
    }
    if (debouncedFilters.originalLanguage) {
      params.set("original_language", debouncedFilters.originalLanguage);
    }
    if (page > 1) {
      params.set("page", String(page));
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
    debouncedFilters.originCountry,
    debouncedFilters.originalLanguage,
    page,
  ]);

  const buildParams = () => {
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
    if (debouncedFilters.originCountry) {
      params.set("origin_country", debouncedFilters.originCountry);
    }
    if (debouncedFilters.originalLanguage) {
      params.set("original_language", debouncedFilters.originalLanguage);
    }
    if (page > 1) params.set("page", String(page));

    return params;
  };

  const searchQuery = useQuery<SearchResponse, Error>({
    queryKey: ["search", searchKey, page],
    enabled,
    queryFn: () => api.search(buildParams()),
    placeholderData: keepPreviousData,
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

      queryClient.setQueryData<SearchResponse>(["search", searchKey, page], (old) => {
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
  const currentPage = searchQuery.data?.page ?? page;

  useEffect(() => {
    if (searchQuery.isError) toast.error("Failed to load search results.");
  }, [searchQuery.isError]);

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

  const pageItems = useMemo(() => {
    if (totalPages <= 1) return [];
    const items: Array<number | "ellipsis"> = [];

    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i += 1) items.push(i);
      return items;
    }

    items.push(1);
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) items.push("ellipsis");
    for (let i = start; i <= end; i += 1) items.push(i);
    if (end < totalPages - 1) items.push("ellipsis");

    items.push(totalPages);
    return items;
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (mediaType === "all") {
      setSelectedGenres([]);
    }
  }, [mediaType]);

  const availableGenres =
    mediaType === "movie"
      ? (searchGenresQuery.data?.movie_genres ?? [])
      : mediaType === "tv"
        ? (searchGenresQuery.data?.tv_genres ?? [])
        : [
            ...(searchGenresQuery.data?.movie_genres ?? []),
            ...(searchGenresQuery.data?.tv_genres ?? []),
          ];

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
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const FiltersForm = (
    <div className="space-y-5">
      <FilterField label="Type">
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
      </FilterField>

      <FilterField label="Genres">
        {mediaType === "all" ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            Choose Movie or TV to filter by genre.
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border border-border/60 bg-card/60 p-3">
            <Select
              value={genreMode}
              onValueChange={(value) => setGenreMode(value as "all" | "any")}
            >
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
            </ScrollArea>
          </div>
        )}
      </FilterField>

      <FilterField label="Origin country">
        <CountryCombobox
          value={originCountry}
          onValueChange={setOriginCountry}
          options={availableCountries}
          placeholder="Any"
          anyLabel="Any"
        />
      </FilterField>

      <FilterField label="Original language">
        <LanguageCombobox
          value={originalLanguage}
          onValueChange={setOriginalLanguage}
          options={availableLanguages}
          placeholder="Any"
          anyLabel="Any"
        />
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

  const isInitialLoading =
    searchQuery.isLoading || (searchQuery.isFetching && results.length === 0);

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
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            className="w-full max-w-md"
          />
        </form>

        <div className="text-xs text-muted-foreground">{renderResultsCount()}</div>

        {isInitialLoading ? <LoadingGrid /> : null}

        {!searchQuery.isLoading && !searchQuery.isFetching && !results.length && enabled ? (
          <Empty className="border-border/60 bg-card/30">
            <EmptyHeader>
              <EmptyTitle>No results yet</EmptyTitle>
              <EmptyDescription>Try adjusting the filters or search again.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        <CardGrid>
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
                  className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                  onClick={(event) => {
                    event.preventDefault();
                    if (currentPage <= 1) return;
                    setPage(currentPage - 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
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
                      isActive={item === currentPage}
                      onClick={(event) => {
                        event.preventDefault();
                        setPage(item);
                        window.scrollTo({ top: 0, behavior: "smooth" });
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
                  className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                  onClick={(event) => {
                    event.preventDefault();
                    if (currentPage >= totalPages) return;
                    setPage(currentPage + 1);
                    window.scrollTo({ top: 0, behavior: "smooth" });
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
