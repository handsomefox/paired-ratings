import CardGrid from "@/components/card-grid";
import { LoadingGrid } from "@/components/loading-grid";
import { OriginCountriesChip } from "@/components/origin-countries-chip";
import RatingChips from "@/components/rating-chips";
import { ShowCard } from "@/components/show-card";
import { TmdbRatingBadge } from "@/components/tmdb-rating-badge";
import { ViewTransitionLink } from "@/components/view-transition-link";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { ApiShow } from "@/lib/api";
import { shortGenres } from "@/lib/utils";
import { Film } from "lucide-react";

export type LibraryResultsProps = {
  shows: ApiShow[];
  imageBase: string;
  isInitialLoading: boolean;
  isEmpty: boolean;
  fromLocation: string;
};

export function LibraryResults({
  shows,
  imageBase,
  isInitialLoading,
  isEmpty,
  fromLocation,
}: LibraryResultsProps) {
  return (
    <>
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
                <ViewTransitionLink
                  to="/show/$showId"
                  params={{ showId: String(show.id) }}
                  search={{ from: fromLocation }}
                >
                  {show.title}
                </ViewTransitionLink>
              }
              year={show.year}
              posterAlt={show.title}
              posterPath={show.poster_path}
              imageBase={imageBase}
              posterLink={(node) => (
                <ViewTransitionLink
                  to="/show/$showId"
                  params={{ showId: String(show.id) }}
                  search={{ from: fromLocation }}
                >
                  {node}
                </ViewTransitionLink>
              )}
              statusBadge={
                <div
                  className={`py-1 pl-2.5 pr-5 text-xs font-bold capitalize tracking-wide text-white backdrop-blur-sm [clip-path:polygon(0_0,100%_0,calc(100%-10px)_100%,0_100%)] ${
                    show.status === "watched"
                      ? "bg-bf/75"
                      : show.status === "watching"
                        ? "bg-amber-500/75"
                        : "bg-gf/75"
                  }`}
                >
                  {show.status || "planned"}
                </div>
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
              footer={<RatingChips bfRating={show.bf_rating} gfRating={show.gf_rating} />}
              genresText={show.genres ? shortGenres(show.genres) : ""}
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
              overview={show.overview}
            />
          );
        })}
      </CardGrid>
    </>
  );
}
