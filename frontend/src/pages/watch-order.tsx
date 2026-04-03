import { LoadingGrid } from "@/components/loading-grid";
import { PriorityBadge } from "@/components/priority-badge";
import { PrioritySelector } from "@/components/priority-selector";
import { ViewTransitionLink } from "@/components/view-transition-link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPrioritySummary } from "@/features/library/library-utils";
import type { ApiShow, PriorityRequest } from "@/lib/api";
import { api } from "@/lib/api";
import { cn, shortGenres } from "@/lib/utils";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Film } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type PriorityDrafts = Record<number, { bf: number | null; gf: number | null }>;

export function WatchOrderPage() {
  const queryClient = useQueryClient();
  const [drafts, setDrafts] = useState<PriorityDrafts>({});
  const [pendingDelete, setPendingDelete] = useState<ApiShow | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: api.session,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("status", "planned");
    p.set("sort", "priority");
    return p;
  }, []);

  const showsQuery = useQuery({
    queryKey: ["shows", params.toString()],
    queryFn: () => api.listShows(params),
    placeholderData: keepPreviousData,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PriorityRequest }) =>
      api.updatePriority(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[variables.id];
        return next;
      });
      toast.success("Priority saved.");
    },
    onError: () => {
      toast.error("Failed to save priority.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteShow(id),
    onSuccess: () => {
      setPendingDelete(null);
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast.success("Show deleted.");
    },
    onError: () => {
      toast.error("Failed to delete show.");
    },
  });

  const shows = showsQuery.data?.shows ?? [];
  const imageBase = sessionQuery.data?.image_base ?? "";
  const bfName = sessionQuery.data?.bf_name ?? "BF";
  const gfName = sessionQuery.data?.gf_name ?? "GF";

  const isInitialLoading = showsQuery.isLoading || (showsQuery.isFetching && shows.length === 0);
  const isEmpty = !showsQuery.isLoading && !showsQuery.isFetching && shows.length === 0;

  const getDraft = (show: ApiShow) => {
    const currentBf = show.bf_watch_priority ?? null;
    const currentGf = show.gf_watch_priority ?? null;
    const draft = drafts[show.id];
    return {
      bfValue: draft?.bf ?? currentBf,
      gfValue: draft?.gf ?? currentGf,
      currentBf,
      currentGf,
    };
  };

  const handleSave = (show: ApiShow) => {
    const { bfValue, gfValue, currentBf, currentGf } = getDraft(show);
    const bfDirty = bfValue !== currentBf;
    const gfDirty = gfValue !== currentGf;
    if (!bfDirty && !gfDirty) return;

    if (bfValue !== null && (bfValue < 1 || bfValue > 5)) {
      toast.error("BF priority must be 1–5.");
      return;
    }
    if (gfValue !== null && (gfValue < 1 || gfValue > 5)) {
      toast.error("GF priority must be 1–5.");
      return;
    }

    const payload: PriorityRequest = {};
    if (bfDirty) payload.bf_priority = bfValue ?? 0;
    if (gfDirty) payload.gf_priority = gfValue ?? 0;

    updateMutation.mutate({ id: show.id, payload });
  };

  return (
    <section className="space-y-5">
      <div className="space-y-1">
        <h1 className="font-display text-xl sm:text-2xl">Watch order</h1>
        <p className="text-sm text-muted-foreground">
          Set priorities for planned shows. Average priority sorts the list.
        </p>
      </div>

      {isInitialLoading ? <LoadingGrid /> : null}

      {isEmpty ? (
        <Empty className="border-border/60 bg-card/30">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Film />
            </EmptyMedia>
            <EmptyTitle>No planned shows yet</EmptyTitle>
            <EmptyDescription>Add something in the library first.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      <div className="rounded-2xl border border-border/60 bg-card/70 shadow-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Show</TableHead>
              <TableHead className="w-[72px] text-center">Year</TableHead>
              <TableHead className="w-[90px] text-center">Avg</TableHead>
              <TableHead className="w-[96px] text-center">{bfName}</TableHead>
              <TableHead className="w-[96px] text-center">{gfName}</TableHead>
              <TableHead className="w-[140px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shows.map((show) => {
              const { bfValue, gfValue, currentBf, currentGf } = getDraft(show);
              const prioritySummary = getPrioritySummary(bfValue ?? undefined, gfValue ?? undefined);
              const isDirty = bfValue !== currentBf || gfValue !== currentGf;
              const posterUrl = show.poster_path ? `${imageBase}${show.poster_path}` : "";
              const genres = show.genres ? shortGenres(show.genres) : "";

              return (
                <TableRow key={show.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <ViewTransitionLink
                        to="/show/$showId"
                        params={{ showId: String(show.id) }}
                        search={{ from: "/watch-order" }}
                        className="overflow-hidden rounded-lg border border-border/60"
                      >
                        {posterUrl ? (
                          <img
                            src={posterUrl}
                            alt={show.title}
                            className="h-16 w-11 object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-16 w-11 items-center justify-center bg-muted/50 text-[10px] uppercase text-muted-foreground">
                            —
                          </div>
                        )}
                      </ViewTransitionLink>
                      <div className="space-y-1">
                        <ViewTransitionLink
                          to="/show/$showId"
                          params={{ showId: String(show.id) }}
                          search={{ from: "/watch-order" }}
                          className="font-medium text-foreground hover:text-primary"
                        >
                          {show.title}
                        </ViewTransitionLink>
                        {genres ? (
                          <div className="text-xs text-muted-foreground">{genres}</div>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground">
                    {show.year ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {prioritySummary ? (
                      <div className="flex flex-col items-center gap-1">
                        <PriorityBadge
                          label={prioritySummary.label}
                          warning={prioritySummary.warning}
                          title={
                            prioritySummary.warning
                              ? "Only one priority set"
                              : "Average priority"
                          }
                          className="mx-auto"
                        />
                        {prioritySummary.warning ? (
                          <span className="text-[0.65rem] text-destructive/80">Only one set</span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <PrioritySelector
                        value={bfValue}
                        tone="bf"
                        onChange={(value) => {
                          setDrafts((prev) => ({
                            ...prev,
                            [show.id]: { bf: value, gf: gfValue },
                          }));
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <PrioritySelector
                        value={gfValue}
                        tone="gf"
                        onChange={(value) => {
                          setDrafts((prev) => ({
                            ...prev,
                            [show.id]: { bf: bfValue, gf: value },
                          }));
                        }}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSave(show)}
                        disabled={!isDirty || updateMutation.isPending}
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn("text-red-200 hover:text-red-100")}
                        onClick={() => setPendingDelete(show)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete show?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove “{pendingDelete?.title}” from your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
