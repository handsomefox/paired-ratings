import { OriginCountriesChip } from "@/components/origin-countries-chip";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showStatusOptions } from "@/features/library/library-utils";
import type { ApiShow } from "@/lib/api";
import { formatScore, formatVotes } from "@/lib/utils";

export type DetailHeroProps = {
  show: ApiShow;
  imageBase: string;
  imdbUrl?: string;
  tmdbUrl?: string;
  onSetStatus: (status: string) => void;
  statusPending: boolean;
  onRefresh: () => void;
  refreshPending: boolean;
  onClearRatings: () => void;
  clearPending: boolean;
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
  onClearRatings,
  clearPending,
}: DetailHeroProps) {
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
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl">{show.title}</h1>
            {show.year ? <span className="text-sm text-muted-foreground">{show.year}</span> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <OriginCountriesChip codes={show.origin_country} />
            <Select
              value={show.status || "planned"}
              onValueChange={onSetStatus}
              disabled={statusPending}
            >
              <SelectTrigger className="h-6 w-auto rounded-full border-0 bg-transparent px-2 text-[0.65rem] uppercase tracking-wide shadow-none focus:ring-0 [&>svg]:ml-0.5 [&>svg]:h-3 [&>svg]:w-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
            {show.genres ? <span className="text-muted-foreground">{show.genres}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {imdbUrl ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-full px-3 text-xs font-semibold uppercase tracking-wide"
            >
              <a href={imdbUrl} target="_blank" rel="noopener noreferrer">
                IMDb
              </a>
            </Button>
          ) : null}
          {tmdbUrl ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-full px-3 text-xs font-semibold uppercase tracking-wide"
            >
              <a href={tmdbUrl} target="_blank" rel="noopener noreferrer">
                TMDB
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
              </a>
            </Button>
          ) : (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-full px-3 text-xs font-semibold uppercase tracking-wide"
            >
              <span aria-disabled="true">
                TMDB
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
              </span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full px-3 text-xs"
            onClick={onRefresh}
            disabled={refreshPending}
          >
            Refresh TMDB
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="rounded-full px-3 text-xs"
            onClick={onClearRatings}
            disabled={clearPending}
          >
            Clear ratings
          </Button>
        </div>

        {show.overview ? <p className="text-sm text-muted-foreground">{show.overview}</p> : null}
      </div>
    </div>
  );
}
