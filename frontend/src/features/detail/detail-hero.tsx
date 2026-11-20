import { OriginCountriesChip } from "@/components/origin-countries-chip";
import { TmdbRatingBadge } from "@/components/tmdb-rating-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApiShow } from "@/lib/api";
import type { SearchPageSearch } from "@/features/search/search-utils";
import { displayStatus, showStatusOptions, statusStyle } from "@/lib/status";
import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  ExternalLink,
  ListOrdered,
  MoreHorizontal,
  RotateCcw,
  Telescope,
  Trash2,
} from "lucide-react";

// Taller on phones, where the buttons sit in a two-column grid under a thumb,
// and a long label wraps rather than overflowing its half of the row.
const actionClass =
  "h-auto min-h-10 justify-start whitespace-normal rounded-md px-3 py-2 text-left text-xs leading-tight sm:h-8 sm:min-h-0 sm:whitespace-nowrap sm:py-0";

type DetailHeroProps = {
  show: ApiShow;
  imageBase: string;
  imdbUrl?: string;
  tmdbUrl?: string;
  onSetStatus: (status: string) => void;
  statusPending: boolean;
  onRefresh: () => void;
  refreshPending: boolean;
  onRequestDelete: () => void;
  onAddToWatchOrder: () => void;
  onRemoveFromWatchOrder: () => void;
  watchOrderPending: boolean;
  findSimilarSearch: SearchPageSearch;
};

export function DetailHero({
  show,
  imageBase,
  imdbUrl,
  tmdbUrl,
  onSetStatus,
  statusPending,
  onRefresh,
  refreshPending,
  onRequestDelete,
  onAddToWatchOrder,
  onRemoveFromWatchOrder,
  watchOrderPending,
  findSimilarSearch,
}: DetailHeroProps) {
  const inWatchOrder = show.watch_priority != null;
  const showWatchOrderButton = show.status !== "watched";
  const status = displayStatus(show.status);
  return (
    // On a phone the poster sits beside the title at thumbnail size, so the
    // title, status and actions are on the first screen. From lg up it is a
    // full column on the left.
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-4 gap-y-5 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-lg sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-x-6 sm:p-6 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-x-8 lg:gap-y-6 lg:p-0">
      <div className="self-start overflow-hidden rounded-lg bg-muted/40 lg:row-span-2 lg:rounded-none lg:rounded-l-2xl">
        <div className="aspect-[2/3] overflow-hidden">
          {show.poster_path ? (
            <img
              src={`${imageBase}${show.poster_path}`}
              alt={show.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs uppercase tracking-wide text-muted-foreground">
              No poster
            </div>
          )}
        </div>
      </div>
      <div className="min-w-0 space-y-3 lg:pr-8 lg:pt-8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="text-xl sm:text-2xl">{show.title}</h1>
            {show.year ? <span className="text-sm text-muted-foreground">{show.year}</span> : null}
          </div>
          {/* The rare actions, out of the row of everyday ones, so Delete is
              never one slip away from Find Similar. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="-mr-2 h-8 w-8 shrink-0 rounded-full p-0 text-muted-foreground"
                aria-label="More actions for this show"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem onSelect={onRefresh} disabled={refreshPending}>
                <RotateCcw className="h-4 w-4" />
                <div>
                  <div>Refresh TMDB</div>
                  <div className="text-xs text-muted-foreground">
                    Pull the poster, TMDB rating, and details again
                  </div>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onRequestDelete}
                className="text-destructive focus:bg-destructive/10 focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete show
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Select value={status} onValueChange={onSetStatus} disabled={statusPending}>
            <SelectTrigger
              aria-label="Status"
              className={cn(
                "inset-ring h-8 w-auto cursor-pointer rounded-md border-0 px-[11px] text-xs font-semibold uppercase tracking-wide shadow-none focus:ring-0 [&>svg]:ml-1 [&>svg]:h-3 [&>svg]:w-3",
                statusStyle(status).chip,
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent style={{ minWidth: "var(--radix-select-trigger-width)" }}>
              {showStatusOptions.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className="text-xs uppercase tracking-wide"
                >
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* The same score badge as on the cards, rather than a number
              tucked inside the TMDB link. */}
          <TmdbRatingBadge
            rating={show.tmdb_rating}
            votes={show.tmdb_votes}
            className="h-8 px-[11px] text-xs"
          />
          <OriginCountriesChip codes={show.origin_country} badgeClassName="h-8 px-[11px]" />
        </div>
        {show.genres.length > 0 ? (
          <div className="text-xs text-muted-foreground sm:text-sm">{show.genres.join(", ")}</div>
        ) : null}
      </div>

      <div className="col-span-2 space-y-5 lg:col-span-1 lg:col-start-2 lg:pb-8 lg:pr-8">
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-1.5">
          {imdbUrl ? (
            <Button
              asChild
              variant="secondary"
              size="sm"
              className={cn(actionClass, "font-semibold uppercase tracking-wide")}
            >
              <a href={imdbUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                IMDb
              </a>
            </Button>
          ) : null}
          {tmdbUrl ? (
            <Button
              asChild
              variant="secondary"
              size="sm"
              className={cn(actionClass, "font-semibold uppercase tracking-wide")}
            >
              <a href={tmdbUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                TMDB
              </a>
            </Button>
          ) : null}
          {showWatchOrderButton ? (
            inWatchOrder ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={actionClass}
                onClick={onRemoveFromWatchOrder}
                disabled={watchOrderPending}
              >
                <ListOrdered className="h-3.5 w-3.5" />
                Remove from watch order
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={actionClass}
                onClick={onAddToWatchOrder}
                disabled={watchOrderPending}
              >
                <ListOrdered className="h-3.5 w-3.5" />
                Add to watch order
              </Button>
            )
          ) : null}
          <Button asChild variant="secondary" size="sm" className={actionClass}>
            <Link to="/search" search={findSimilarSearch}>
              <Telescope className="h-3.5 w-3.5" />
              Find Similar
            </Link>
          </Button>
        </div>

        {show.overview ? <p className="text-sm text-muted-foreground">{show.overview}</p> : null}
      </div>
    </div>
  );
}
