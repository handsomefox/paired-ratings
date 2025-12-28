import CardGrid from "@/components/card-grid";
import { LoadingGrid } from "@/components/loading-grid";
import { OriginCountriesChip } from "@/components/origin-countries-chip";
import RatingChips from "@/components/rating-chips";
import { ShowCard } from "@/components/show-card";
import { TmdbRatingBadge } from "@/components/tmdb-rating-badge";
import { ViewTransitionLink } from "@/components/view-transition-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { StatusBadgeVariant } from "@/features/library/library-utils";

export type LibraryResultsProps = {
  shows: ApiShow[];
  imageBase: string;
  isInitialLoading: boolean;
  isEmpty: boolean;
  onDelete: (show: ApiShow) => void;
  statusBadgeVariant: (status?: string) => StatusBadgeVariant;
  fromLocation: string;
};

export function LibraryResults({
  shows,
  imageBase,
  isInitialLoading,
  isEmpty,
  onDelete,
  statusBadgeVariant,
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
              topRight={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="secondary" size="icon" className="h-8 w-8 rounded-full">
                      <span className="sr-only">Open menu</span>
                      <span className="text-lg leading-none">⋯</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onDelete(show)}>Delete</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
              statusBadge={
                <Badge variant={statusBadgeVariant(show.status)}>{show.status || "tbd"}</Badge>
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
              overview={show.overview}
            />
          );
        })}
      </CardGrid>
    </>
  );
}
