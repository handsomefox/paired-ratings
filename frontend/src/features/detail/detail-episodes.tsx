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
  bfName: string;
  gfName: string;
};

type SeasonGroup = {
  season: number;
  episodes: ApiEpisode[];
  bfCount: number;
  gfCount: number;
};

export function DetailEpisodes({ showId, bfName, gfName }: DetailEpisodesProps) {
  const queryClient = useQueryClient();
  const [expandedSeasons, setExpandedSeasons] = useState<Set<number>>(() => new Set());

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
    mutationFn: ({
      episodeId,
      person,
      watched,
    }: {
      episodeId: number;
      person: string;
      watched: boolean;
    }) => api.toggleEpisode(episodeId, person, watched),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<EpisodesResponse>(["episodes", showId], (old) => {
        if (!old) return old;
        return {
          ...old,
          episodes: old.episodes.map((ep) => {
            if (ep.id !== variables.episodeId) return ep;
            return {
              ...ep,
              bf_watched: variables.person === "bf" ? variables.watched : ep.bf_watched,
              gf_watched: variables.person === "gf" ? variables.watched : ep.gf_watched,
            };
          }),
        };
      });
    },
    onError: () => {
      toast.error("Failed to update episode.");
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
        bfCount: eps.filter((e) => e.bf_watched).length,
        gfCount: eps.filter((e) => e.gf_watched).length,
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

  if (episodesQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Episodes</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (seasons.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Episodes</CardTitle>
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
      <CardContent className="space-y-2">
        {seasons.map((group) => {
          const isExpanded = expandedSeasons.has(group.season);
          return (
            <div key={group.season} className="rounded-lg border border-border/60">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium transition hover:bg-muted/40"
                onClick={() => toggleSeason(group.season)}
              >
                <span>Season {group.season}</span>
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {bfName}: {group.bfCount}/{group.episodes.length}
                  </span>
                  <span>
                    {gfName}: {group.gfCount}/{group.episodes.length}
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                  />
                </span>
              </button>
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
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 text-xs">
                          <Checkbox
                            checked={ep.bf_watched}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({
                                episodeId: ep.id,
                                person: "bf",
                                watched: checked === true,
                              })
                            }
                          />
                          <span className="hidden sm:inline">{bfName}</span>
                          <span className="sm:hidden">B</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs">
                          <Checkbox
                            checked={ep.gf_watched}
                            onCheckedChange={(checked) =>
                              toggleMutation.mutate({
                                episodeId: ep.id,
                                person: "gf",
                                watched: checked === true,
                              })
                            }
                          />
                          <span className="hidden sm:inline">{gfName}</span>
                          <span className="sm:hidden">G</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
