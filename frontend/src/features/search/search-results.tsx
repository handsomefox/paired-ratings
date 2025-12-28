import CardGrid from "@/components/card-grid";
import { LanguageBadge } from "@/components/language-badge";
import { LoadingGrid } from "@/components/loading-grid";
import { ShowCard } from "@/components/show-card";
import { TmdbRatingBadge } from "@/components/tmdb-rating-badge";
import { ViewTransitionLink } from "@/components/view-transition-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { SearchResult } from "@/lib/api";
import { cn, shortGenreList } from "@/lib/utils";
import { Search as SearchIcon } from "lucide-react";

export type SearchResultsProps = {
  isInitialLoading: boolean;
  isFetching: boolean;
  results: SearchResult[];
  availableLanguages: Array<{ code: string; name: string }>;
  imageBase: string;
  libraryMap: Map<string, number>;
  expandedOverviews: Set<string>;
  onToggleOverview: (key: string) => void;
  onOpenImdb: (item: SearchResult) => void;
  onAdd: (item: SearchResult, status: string) => void;
  addPending: boolean;
  fromLocation: string;
};

export function SearchResults({
  isInitialLoading,
  isFetching,
  results,
  availableLanguages,
  imageBase,
  libraryMap,
  expandedOverviews,
  onToggleOverview,
  onOpenImdb,
  onAdd,
  addPending,
  fromLocation,
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
            <EmptyTitle>No results yet</EmptyTitle>
            <EmptyDescription>Try adjusting the filters or search again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}
      <CardGrid className={`transition-opacity ${isFetching ? "opacity-60" : "opacity-100"}`}>
        {results.map((item) => {
          const libraryKey = `${item.media_type}:${item.id}`;
          const libraryId = libraryMap.get(libraryKey);
          const languageLabel =
            availableLanguages.find((lang) => lang.code === item.original_language)?.name ??
            item.original_language?.toUpperCase();
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
                  onClick={() => onOpenImdb(item)}
                  aria-label={`Search IMDb for ${item.title}`}
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
                  <Badge
                    variant="outline"
                    className={cn(
                      "flex justify-center",
                      item.original_language ? "w-full" : "col-span-2 w-1/2 justify-self-center",
                    )}
                  >
                    {item.media_type === "movie"
                      ? "Movie"
                      : item.media_type === "tv"
                        ? "TV"
                        : item.media_type}
                  </Badge>
                </>
              }
              metaBadgesClassName="grid-cols-2"
              genresText={item.genres?.length ? shortGenreList(item.genres) : ""}
              overview={item.overview}
              overviewExpanded={expandedOverviews.has(`${item.media_type}-${item.id}`)}
              onToggleOverview={() => onToggleOverview(`${item.media_type}-${item.id}`)}
              footer={
                item.in_library ? (
                  libraryId ? (
                    <ViewTransitionLink
                      to="/show/$showId"
                      params={{ showId: String(libraryId) }}
                      search={{ from: fromLocation }}
                      className="block w-full"
                    >
                      <Badge
                        variant="outline"
                        className="h-8 w-full justify-center gap-1 rounded-md border-primary/40 bg-primary/15 px-3 text-xs text-primary hover:bg-primary/20"
                      >
                        In Library
                      </Badge>
                    </ViewTransitionLink>
                  ) : (
                    <Badge
                      variant="outline"
                      className="h-8 w-full justify-center gap-1 rounded-md border-primary/40 bg-primary/15 px-3 text-xs text-primary"
                    >
                      In Library
                    </Badge>
                  )
                ) : (
                  <div className="grid w-full grid-cols-2 gap-2">
                    <Button
                      variant="gf"
                      size="sm"
                      className="w-full"
                      onClick={() => onAdd(item, "planned")}
                      disabled={addPending}
                    >
                      Plan
                    </Button>
                    <Button
                      variant="bf"
                      size="sm"
                      className="w-full"
                      onClick={() => onAdd(item, "watched")}
                      disabled={addPending}
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
