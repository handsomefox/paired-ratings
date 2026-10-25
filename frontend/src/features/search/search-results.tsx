import CardGrid from "@/components/card-grid";
import { LanguageBadge } from "@/components/language-badge";
import { LoadingGrid } from "@/components/loading-grid";
import { InLibraryLink, MediaTypeBadge } from "@/components/result-badges";
import { ShowCard } from "@/components/show-card";
import { TmdbRatingBadge } from "@/components/tmdb-rating-badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { MediaType } from "@/features/search/search-constants";
import { resultKey } from "@/features/search/search-utils";
import type { ApiLanguage, SearchResult } from "@/lib/api";
import { shortGenres } from "@/lib/utils";
import { Search as SearchIcon } from "lucide-react";

export type SearchResultsProps = {
  isInitialLoading: boolean;
  isFetching: boolean;
  results: SearchResult[];
  availableLanguages: ApiLanguage[];
  imageBase: string;
  expandedOverviews: Set<string>;
  onToggleOverview: (key: string) => void;
  onOpenImdb: (item: SearchResult) => void;
  onAdd: (item: SearchResult, status: string) => void;
  /** The result being added, if any. Only its buttons are disabled. */
  pendingKey?: string;
  fromLocation: string;
  query?: string;
  mediaType: MediaType;
  onSwitchMediaType: (type: MediaType) => void;
};

export function SearchResults({
  isInitialLoading,
  isFetching,
  results,
  availableLanguages,
  imageBase,
  expandedOverviews,
  onToggleOverview,
  onOpenImdb,
  onAdd,
  pendingKey,
  fromLocation,
  query,
  mediaType,
  onSwitchMediaType,
}: SearchResultsProps) {
  return (
    <>
      {isInitialLoading ? <LoadingGrid /> : null}

      {!isInitialLoading && results.length === 0 ? (
        <Empty className="border-border/60 bg-card/30">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>{query ? "No results found" : "No results yet"}</EmptyTitle>
            <EmptyDescription>
              {query ? (
                <>
                  No {mediaType === "movie" ? "movie" : "TV show"} results for &ldquo;{query}
                  &rdquo;.{" "}
                  <button
                    type="button"
                    className="cursor-pointer font-medium text-primary underline-offset-2 hover:underline"
                    onClick={() => onSwitchMediaType(mediaType === "movie" ? "tv" : "movie")}
                  >
                    Try {mediaType === "movie" ? "TV shows" : "movies"} instead?
                  </button>
                </>
              ) : (
                "Try adjusting the filters or search again."
              )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      <CardGrid className={`transition-opacity ${isFetching ? "opacity-60" : "opacity-100"}`}>
        {results.map((item) => {
          const key = resultKey(item);
          const languageLabel =
            availableLanguages.find((lang) => lang.code === item.original_language)?.name ??
            item.original_language.toUpperCase();
          const adding = pendingKey === key;
          return (
            <ShowCard
              key={key}
              title={item.title}
              year={item.year}
              posterAlt={item.title}
              posterPath={item.poster_path}
              imageBase={imageBase}
              posterLink={(node) => (
                <button
                  type="button"
                  className="block w-full cursor-pointer text-left"
                  onClick={() => onOpenImdb(item)}
                  aria-label={`Open ${item.title} on IMDb`}
                >
                  {node}
                </button>
              )}
              metaBadges={
                <>
                  <TmdbRatingBadge
                    rating={item.vote_average}
                    votes={item.vote_count}
                    className="col-span-2 flex w-full justify-center"
                  />
                  <LanguageBadge code={item.original_language} label={languageLabel} />
                  <MediaTypeBadge mediaType={item.media_type} fullWidth={!item.original_language} />
                </>
              }
              metaBadgesClassName="grid-cols-2"
              genresText={shortGenres(item.genres)}
              overview={item.overview}
              overviewExpanded={expandedOverviews.has(key)}
              onToggleOverview={() => onToggleOverview(key)}
              footer={
                item.library_id ? (
                  <InLibraryLink libraryId={item.library_id} from={fromLocation} />
                ) : (
                  <div className="grid w-full grid-cols-2 gap-2">
                    <Button
                      variant="gf"
                      size="sm"
                      className="w-full"
                      onClick={() => onAdd(item, "planned")}
                      disabled={adding}
                    >
                      Plan
                    </Button>
                    <Button
                      variant="bf"
                      size="sm"
                      className="w-full"
                      onClick={() => onAdd(item, "watched")}
                      disabled={adding}
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
    </>
  );
}
