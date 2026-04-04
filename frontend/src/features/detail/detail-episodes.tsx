import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { ApiEpisode, EpisodesResponse } from "@/lib/api";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type DetailEpisodesProps = {
  showId: number;
};

type SeasonGroup = {
  season: number;
  episodes: ApiEpisode[];
  watchedCount: number;
};

export function DetailEpisodes({ showId }: DetailEpisodesProps) {
  const queryClient = useQueryClient();
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(() => new Set());
  const [mobileOpen, setMobileOpen] = useState(false);

  const episodesQuery = useQuery<EpisodesResponse>({
    queryKey: ["episodes", showId],
    queryFn: () => api.getEpisodes(showId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const syncMutation = useMutation({
    mutationFn: () => api.syncEpisodes(showId),
    onSuccess: (data) => {
      queryClient.setQueryData(["episodes", showId], data);
      toast.success("Episodes synced from TMDB.");
    },
    onError: () => {
      toast.error("Failed to sync episodes.");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ episodeId, watched }: { episodeId: number; watched: boolean }) =>
      api.toggleEpisode(episodeId, watched),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<EpisodesResponse>(["episodes", showId], (old) => {
        if (!old) return old;
        return {
          ...old,
          episodes: old.episodes.map((ep) => {
            if (ep.id !== variables.episodeId) return ep;
            return { ...ep, watched: variables.watched };
          }),
        };
      });
    },
    onError: () => {
      toast.error("Failed to update episode.");
    },
  });

  const toggleSeasonMutation = useMutation({
    mutationFn: ({ season, watched }: { season: number; watched: boolean }) =>
      api.toggleSeason(showId, season, watched),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<EpisodesResponse>(["episodes", showId], (old) => {
        if (!old) return old;
        return {
          ...old,
          episodes: old.episodes.map((ep) => {
            if (ep.season_number !== variables.season) return ep;
            return { ...ep, watched: variables.watched };
          }),
        };
      });
    },
    onError: () => {
      toast.error("Failed to update season.");
    },
  });

  const seasons = useMemo((): SeasonGroup[] => {
    const episodes = episodesQuery.data?.episodes ?? [];
    const map = new Map<number, ApiEpisode[]>();
    for (const ep of episodes) {
      const list = map.get(ep.season_number) ?? [];
      list.push(ep);
      map.set(ep.season_number, list);
    }
    const groups: SeasonGroup[] = [];
    for (const [season, eps] of map) {
      groups.push({
        season,
        episodes: eps.sort((a, b) => a.episode_number - b.episode_number),
        watchedCount: eps.filter((e) => e.watched).length,
      });
    }
    return groups.sort((a, b) => a.season - b.season);
  }, [episodesQuery.data?.episodes]);

  const toggleSeason = (season: number) => {
    setExpandedSeasons((prev) => {
      const next = new Set(prev);
      if (next.has(season)) next.delete(season);
      else next.add(season);
      return next;
    });
  };

  const totalWatched = seasons.reduce((acc, g) => acc + g.watchedCount, 0);
  const totalEpisodes = seasons.reduce((acc, g) => acc + g.episodes.length, 0);

  const episodesCard = (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 text-left lg:cursor-default"
          onClick={() => setMobileOpen((o) => !o)}
        >
          <CardTitle className="text-base">Episodes</CardTitle>
          {seasons.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {totalWatched}/{totalEpisodes}
            </span>
          )}
          <ChevronDown
            className={`ml-auto h-4 w-4 shrink-0 transition-transform lg:hidden ${mobileOpen ? "rotate-180" : ""}`}
          />
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
        >
          {syncMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Sync
        </Button>
      </CardHeader>
      <div className={`${mobileOpen ? "block" : "hidden"} lg:block`}>
        {episodesQuery.isLoading ? (
          <CardContent className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </CardContent>
        ) : (
          <CardContent className="space-y-2">
            {seasons.map((group) => {
              const isExpanded = expandedSeasons.has(group.season);
              return (
                <div key={group.season} className="rounded-lg border border-border/60">
                  <div className="flex w-full items-center gap-2 px-3 py-2.5">
                    <button
                      type="button"
                      className="flex flex-1 items-center justify-between gap-2 text-left text-sm font-medium transition"
                      onClick={() => toggleSeason(group.season)}
                    >
                      <span>Season {group.season}</span>
                      <span className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          {group.watchedCount}/{group.episodes.length} watched
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </span>
                    </button>
                    <Checkbox
                      checked={
                        group.watchedCount === group.episodes.length
                          ? true
                          : group.watchedCount === 0
                            ? false
                            : "indeterminate"
                      }
                      onCheckedChange={(checked) =>
                        toggleSeasonMutation.mutate({
                          season: group.season,
                          watched: checked === true,
                        })
                      }
                      aria-label={`Mark all Season ${group.season} as watched`}
                    />
                  </div>
                  {isExpanded && (
                    <div className="border-t border-border/40">
                      {group.episodes.map((ep) => (
                        <div
                          key={ep.id}
                          className="flex items-center gap-3 border-b border-border/20 px-3 py-2 last:border-b-0"
                        >
                          <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">
                            {ep.episode_number}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm">
                              {ep.title ?? `Episode ${ep.episode_number}`}
                            </div>
                            <div className="flex gap-3 text-[10px] text-muted-foreground">
                              {ep.air_date && <span>{ep.air_date}</span>}
                              {ep.runtime != null && ep.runtime > 0 && <span>{ep.runtime}m</span>}
                            </div>
                          </div>
                          <Checkbox
                            checked={ep.watched}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({
                                episodeId: ep.id,
                                watched: checked === true,
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        )}
      </div>
    </Card>
  );

  if (episodesQuery.isLoading && seasons.length === 0) {
    return episodesCard;
  }

  if (!episodesQuery.isLoading && seasons.length === 0) return null;

  return episodesCard;
}
