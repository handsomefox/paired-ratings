import FiltersPane from "@/components/filters-pane";
import { FiltersPaneContent } from "@/components/filters-pane-content";
import { Input } from "@/components/ui/input";
import { SearchFilters } from "@/features/search/search-filters";
import { SearchPagination } from "@/features/search/search-pagination";
import { SearchResults } from "@/features/search/search-results";
import { type MediaType, type Sort } from "@/features/search/search-constants";
import {
  buildBaseParams,
  getPageItems,
  parseGenres,
  sanitizeMediaType,
  sanitizeSort,
} from "@/features/search/search-utils";
import type { SearchResponse, SearchResult } from "@/lib/api";
import { api } from "@/lib/api";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { useKeyboardInset } from "@/lib/use-keyboard-inset";
import { useMediaQuery } from "@/lib/use-media-query";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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

  useKeyboardInset();

  const initialGenres = useMemo(
    () => parseGenres(initialParams.get("genres") ?? ""),
    [initialParams],
  );
  const [genreMode, setGenreMode] = useState<"all" | "any">(initialGenres.mode);
  const [selectedGenres, setSelectedGenres] = useState<string[]>(initialGenres.selected);

  const resetPageAndOverviews = () => {
    setPage(1);
    setExpandedOverviews(new Set());
  };

  const handleMediaTypeChange = (value: MediaType) => {
    setMediaType(value);
    setGenreMode("all");
    setSelectedGenres([]);
    resetPageAndOverviews();
  };

  const handleQueryChange = (value: string) => {
    setQueryInput(value);
    resetPageAndOverviews();
  };

  const handleYearFromChange = (value: string) => {
    setYearFrom(value);
    resetPageAndOverviews();
  };

  const handleYearToChange = (value: string) => {
    setYearTo(value);
    resetPageAndOverviews();
  };

  const handleMinRatingChange = (value: string) => {
    setMinRating(value);
    resetPageAndOverviews();
  };

  const handleMinVotesChange = (value: string) => {
    setMinVotes(value);
    resetPageAndOverviews();
  };

  const handleGenreModeChange = (value: "all" | "any") => {
    setGenreMode(value);
    resetPageAndOverviews();
  };

  const handleSelectedGenresChange = (next: string[]) => {
    setSelectedGenres(next);
    resetPageAndOverviews();
  };

  const handleOriginCountryChange = (value: string) => {
    setOriginCountry(value);
    resetPageAndOverviews();
  };

  const handleOriginalLanguageChange = (value: string) => {
    setOriginalLanguage(value);
    resetPageAndOverviews();
  };

  const handleSortChange = (value: Sort) => {
    setSort(value);
    resetPageAndOverviews();
  };

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
  const activePage = searchQuery.data?.page ?? page;

  const urlParamsString = useMemo(() => {
    const params = buildBaseParams({
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
    if (activePage > 1) params.set("page", String(activePage));
    return params.toString();
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
    activePage,
  ]);

  const fromLocation = urlParamsString ? `/search?${urlParamsString}` : "/search";

  useEffect(() => {
    window.history.replaceState(null, "", fromLocation);
  }, [fromLocation]);

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

  const results = useMemo(
    () => searchQuery.data?.results?.filter((item): item is SearchResult => Boolean(item)) ?? [],
    [searchQuery.data?.results],
  );

  const totalResults = searchQuery.data?.total_results ?? 0;
  const totalPages = searchQuery.data?.total_pages ?? 0;
  const isCompactPagination = useMediaQuery("(max-width: 640px)");

  const needsLibraryMap = useMemo(() => results.some((item) => item.in_library), [results]);
  const libraryMapQuery = useQuery({
    queryKey: ["library-map"],
    queryFn: () => api.listShows(new URLSearchParams()),
    enabled: needsLibraryMap,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });
  const libraryMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const show of libraryMapQuery.data?.shows ?? []) {
      map.set(`${show.media_type}:${show.tmdb_id}`, show.id);
    }
    return map;
  }, [libraryMapQuery.data]);

  const pageItems = useMemo(() => {
    if (!totalPages || totalPages <= 1) return [];
    const siblingCount = isCompactPagination ? 1 : 2;
    return getPageItems(totalPages, activePage, siblingCount, 1);
  }, [totalPages, activePage, isCompactPagination]);

  const goToPage = (next: number) => {
    const clamped = totalPages ? Math.max(1, Math.min(totalPages, next)) : Math.max(1, next);
    if (clamped === activePage && clamped === page) return;
    setPage(clamped);
    setExpandedOverviews(new Set());
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  };

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

  const handleResetFilters = () => {
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
    setExpandedOverviews(new Set());
  };

  const FiltersForm = (
    <SearchFilters
      mediaType={mediaType}
      onMediaTypeChange={handleMediaTypeChange}
      genreMode={genreMode}
      onGenreModeChange={handleGenreModeChange}
      selectedGenres={selectedGenres}
      onSelectedGenresChange={handleSelectedGenresChange}
      availableGenres={availableGenres}
      genresLoading={searchGenresQuery.isLoading}
      originCountry={originCountry}
      onOriginCountryChange={handleOriginCountryChange}
      originalLanguage={originalLanguage}
      onOriginalLanguageChange={handleOriginalLanguageChange}
      availableCountries={availableCountries}
      availableLanguages={availableLanguages}
      yearFrom={yearFrom}
      onYearFromChange={handleYearFromChange}
      yearTo={yearTo}
      onYearToChange={handleYearToChange}
      minRating={minRating}
      onMinRatingChange={handleMinRatingChange}
      minVotes={minVotes}
      onMinVotesChange={handleMinVotesChange}
      sort={sort}
      onSortChange={handleSortChange}
      onReset={handleResetFilters}
    />
  );

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
            onChange={(event) => handleQueryChange(event.target.value)}
            autoFocus
            className="w-full max-w-md md:max-w-lg lg:max-w-xl"
          />
        </form>

        <div className="text-xs text-muted-foreground sm:text-sm">{renderResultsCount()}</div>

        <SearchResults
          isInitialLoading={isInitialLoading}
          isFetching={isFetching}
          results={results}
          availableLanguages={availableLanguages}
          imageBase={imageBase}
          libraryMap={libraryMap}
          expandedOverviews={expandedOverviews}
          onToggleOverview={toggleOverview}
          onOpenImdb={(item) => void handleOpenImdb(item)}
          onAdd={handleAdd}
          addPending={addMutation.isPending}
          fromLocation={fromLocation}
        />

        <SearchPagination
          totalPages={totalPages}
          activePage={activePage}
          isCompact={isCompactPagination}
          pageItems={pageItems}
          onGoToPage={goToPage}
        />
      </FiltersPaneContent>
    </FiltersPane>
  );
}
