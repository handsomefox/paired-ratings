import { OriginCountriesChip } from "@/components/origin-countries-chip";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ApiShow } from "@/lib/api";
import { showStatusOptions, statusStyle } from "@/lib/status";
import { cn, formatScore, formatVotes } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import { ExternalLink, ListOrdered, Telescope, RotateCcw, Trash2 } from "lucide-react";

export type DetailHeroProps = {
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
  findSimilarSearch: { media_type: string; genre_names?: string };
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
  const status = show.status || "planned";
  const tmdbScore = (
    <span className="font-normal normal-case text-muted-foreground">
      {show.tmdb_rating ? (
        <>
          {formatScore(show.tmdb_rating)}
          {show.tmdb_votes ? ` (${formatVotes(show.tmdb_votes)})` : ""}
        </>
      ) : (
        "—"
      )}
    </span>
  );
  return (
    <div className="grid gap-6 rounded-2xl border border-border/60 bg-card/70 shadow-lg lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)] lg:gap-8">
      <div className="overflow-hidden bg-muted/40">
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
      <div className="space-y-6 p-6 lg:p-8">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl">{show.title}</h1>
            {show.year ? <span className="text-sm text-muted-foreground">{show.year}</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Select value={status} onValueChange={onSetStatus} disabled={statusPending}>
              <SelectTrigger
                aria-label="Status"
                className={cn(
                  "h-7 w-auto cursor-pointer rounded-md border px-2.5 text-xs font-semibold uppercase tracking-wide shadow-none focus:ring-0 [&>svg]:ml-1 [&>svg]:h-3 [&>svg]:w-3",
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
            <OriginCountriesChip codes={show.origin_country} />
            {show.genres.length > 0 ? (
              <span className="text-muted-foreground">{show.genres.join(", ")}</span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {imdbUrl ? (
            <Button
              asChild
              variant="secondary"
              size="sm"
              className="justify-start rounded-md px-3 text-xs font-semibold uppercase tracking-wide"
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
              className="justify-start rounded-md px-3 text-xs font-semibold uppercase tracking-wide"
            >
              <a href={tmdbUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3" />
                TMDB
                {tmdbScore}
              </a>
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              disabled
              className="justify-start rounded-md px-3 text-xs font-semibold uppercase tracking-wide"
            >
              TMDB
              {tmdbScore}
            </Button>
          )}
          {showWatchOrderButton ? (
            inWatchOrder ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="justify-start rounded-md px-3 text-xs"
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
                className="justify-start rounded-md px-3 text-xs"
                onClick={onAddToWatchOrder}
                disabled={watchOrderPending}
              >
                <ListOrdered className="h-3.5 w-3.5" />
                Add to watch order
              </Button>
            )
          ) : null}
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="justify-start rounded-md px-3 text-xs"
          >
            <Link to="/search" search={findSimilarSearch}>
              <Telescope className="h-3.5 w-3.5" />
              Find Similar
            </Link>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="justify-start rounded-md px-3 text-xs"
            onClick={onRefresh}
            disabled={refreshPending}
          >
            <RotateCcw className="h-3 w-3" />
            Refresh TMDB
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-md px-3 text-xs text-destructive hover:text-destructive"
            onClick={onRequestDelete}
          >
            <Trash2 className="h-3 w-3" />
            Delete show
          </Button>
        </div>

        {show.overview ? <p className="text-sm text-muted-foreground">{show.overview}</p> : null}
      </div>
    </div>
  );
}
