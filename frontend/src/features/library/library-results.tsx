import { CardGrid } from "@/components/card-grid";
import { LoadingGrid } from "@/components/loading-grid";
import { OriginCountriesChip } from "@/components/origin-countries-chip";
import { RatingChips } from "@/components/rating-chips";
import { ShowCard } from "@/components/show-card";
import { ShowLink } from "@/components/show-link";
import { TmdbRatingBadge } from "@/components/tmdb-rating-badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { ApiShow } from "@/lib/api";
import { displayStatus, statusStyle } from "@/lib/status";
import { cn, shortGenres } from "@/lib/utils";
import { CircleAlert, Film } from "lucide-react";

type LibraryResultsProps = {
  shows: ApiShow[];
  imageBase: string;
  bfName: string;
  gfName: string;
  isInitialLoading: boolean;
  isEmpty: boolean;
  isError: boolean;
  hasFilters: boolean;
};

export function LibraryResults({
  shows,
  imageBase,
  bfName,
  gfName,
  isInitialLoading,
  isEmpty,
  isError,
  hasFilters,
}: LibraryResultsProps) {
  return (
    <>
      {isInitialLoading ? <LoadingGrid /> : null}

      {isError ? (
        <Empty className="border-border/60 bg-card/30">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CircleAlert />
            </EmptyMedia>
            <EmptyTitle>Could not load the library</EmptyTitle>
            <EmptyDescription>Pull down or reload the page to try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {isEmpty ? (
        <Empty className="border-border/60 bg-card/30">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Film />
            </EmptyMedia>
            {hasFilters ? (
              <>
                <EmptyTitle>No shows match</EmptyTitle>
                <EmptyDescription>Try loosening or resetting the filters.</EmptyDescription>
              </>
            ) : (
              <>
                <EmptyTitle>No shows yet</EmptyTitle>
                <EmptyDescription>Use “Add” to pull from TMDB.</EmptyDescription>
              </>
            )}
          </EmptyHeader>
        </Empty>
      ) : null}

      <CardGrid>
        {shows.map((show) => {
          const originCountries = show.origin_country;
          const status = displayStatus(show.status);
          return (
            <ShowCard
              key={show.id}
              title={<ShowLink showId={show.id}>{show.title}</ShowLink>}
              year={show.year}
              posterAlt={show.title}
              posterPath={show.poster_path}
              imageBase={imageBase}
              posterLink={(node) => (
                // The title link is the one in the tab order. This one only
                // makes the poster clickable.
                <ShowLink showId={show.id} hidden>
                  {node}
                </ShowLink>
              )}
              statusBadge={
                <div
                  className={cn(
                    "py-1 pl-2.5 pr-5 text-xs font-bold capitalize tracking-wide text-white backdrop-blur-sm [clip-path:polygon(0_0,100%_0,calc(100%-10px)_100%,0_100%)]",
                    statusStyle(status).ribbon,
                  )}
                >
                  {status}
                </div>
              }
              metaBadges={
                <>
                  <TmdbRatingBadge
                    rating={show.tmdb_rating}
                    votes={show.tmdb_votes}
                    className={cn(
                      "flex w-full justify-center",
                      // Not every title reports a country. Fill the row rather
                      // than leaving half of it empty.
                      originCountries.length === 0 && "col-span-2",
                    )}
                  />
                  <OriginCountriesChip
                    codes={originCountries}
                    className="w-full"
                    badgeClassName="flex w-full justify-center"
                  />
                </>
              }
              footer={
                <RatingChips
                  bfName={bfName}
                  gfName={gfName}
                  bfRating={show.bf_rating}
                  gfRating={show.gf_rating}
                />
              }
              genresText={shortGenres(show.genres)}
              episodeMeta={
                show.media_type === "tv" &&
                show.status === "watching" &&
                show.total_episodes != null &&
                show.total_episodes > 0 ? (
                  <div className="text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {show.watched_episodes ?? 0}/{show.total_episodes} eps
                    </span>
                  </div>
                ) : undefined
              }
            />
          );
        })}
      </CardGrid>
    </>
  );
}
