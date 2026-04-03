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
import { PrioritySelector } from "@/components/priority-selector";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DetailHero } from "@/features/detail/detail-hero";
import { DetailRatings } from "@/features/detail/detail-ratings";
import { getPrioritySummary } from "@/features/library/library-utils";
import type { ApiShow, PriorityRequest } from "@/lib/api";
import { api } from "@/lib/api";
import { combinedRating } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export type DetailContentProps = {
  show: ApiShow;
  showId: number;
  imageBase: string;
  imdbUrl?: string;
  bfName: string;
  gfName: string;
  backLabel: string;
  onBack: () => void;
};


export function DetailContent({
  show,
  showId,
  imageBase,
  imdbUrl,
  bfName,
  gfName,
  backLabel,
  onBack,
}: DetailContentProps) {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState(false);
  const [bfRating, setBfRating] = useState<number | null>(() => show.bf_rating ?? null);
  const [gfRating, setGfRating] = useState<number | null>(() => show.gf_rating ?? null);
  const [bfComment, setBfComment] = useState(() => show.bf_comment ?? "");
  const [gfComment, setGfComment] = useState(() => show.gf_comment ?? "");
  const [bfEditing, setBfEditing] = useState(() => !(show.bf_comment && show.bf_comment.trim()));
  const [gfEditing, setGfEditing] = useState(() => !(show.gf_comment && show.gf_comment.trim()));
  const [initialState, setInitialState] = useState(() => ({
    bfRating: show.bf_rating ?? null,
    gfRating: show.gf_rating ?? null,
    bfComment: show.bf_comment ?? "",
    gfComment: show.gf_comment ?? "",
  }));
  const [bfPriority, setBfPriority] = useState<number | null>(
    () => show.bf_watch_priority ?? null,
  );
  const [gfPriority, setGfPriority] = useState<number | null>(
    () => show.gf_watch_priority ?? null,
  );
  const [initialPriority, setInitialPriority] = useState(() => ({
    bf: show.bf_watch_priority ?? null,
    gf: show.gf_watch_priority ?? null,
  }));

  const isDirty = useMemo(() => {
    return (
      bfRating !== initialState.bfRating ||
      gfRating !== initialState.gfRating ||
      bfComment.trim() !== initialState.bfComment.trim() ||
      gfComment.trim() !== initialState.gfComment.trim()
    );
  }, [bfRating, gfRating, bfComment, gfComment, initialState]);

  const priorityDirty =
    bfPriority !== initialPriority.bf || gfPriority !== initialPriority.gf;
  const draftPrioritySummary = getPrioritySummary(bfPriority ?? undefined, gfPriority ?? undefined);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateRatings(showId, {
        bf_rating: bfRating ?? undefined,
        gf_rating: gfRating ?? undefined,
        bf_comment: bfComment,
        gf_comment: gfComment,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["show", String(showId)], data);
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      if (!data.show) {
        return;
      }
      const next = {
        bfRating: data.show.bf_rating ?? null,
        gfRating: data.show.gf_rating ?? null,
        bfComment: data.show.bf_comment ?? "",
        gfComment: data.show.gf_comment ?? "",
      };
      setInitialState(next);
      setBfRating(next.bfRating);
      setGfRating(next.gfRating);
      setBfComment(next.bfComment);
      setGfComment(next.gfComment);
      setBfEditing(!next.bfComment.trim());
      setGfEditing(!next.gfComment.trim());
      toast.success("Ratings saved.");
      onBack();
    },
    onError: () => {
      toast.error("Failed to save ratings.");
    },
  });

  const updatePriorityMutation = useMutation({
    mutationFn: (payload: PriorityRequest) => api.updatePriority(showId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["show", String(showId)], data);
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      if (!data.show) {
        return;
      }
      const next = {
        bf: data.show.bf_watch_priority ?? null,
        gf: data.show.gf_watch_priority ?? null,
      };
      setInitialPriority(next);
      setBfPriority(next.bf);
      setGfPriority(next.gf);
      toast.success("Priority saved.");
    },
    onError: () => {
      toast.error("Failed to save priority.");
    },
  });

  const setStatusMutation = useMutation({
    mutationFn: (status: string) => api.setStatus(showId, status),
    onSuccess: (data) => {
      queryClient.setQueryData(["show", String(showId)], data);
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast.success(`Marked ${data.show?.status ?? "updated"}.`);
    },
    onError: () => {
      toast.error("Failed to update status.");
    },
  });

  const clearRatingsMutation = useMutation({
    mutationFn: () => api.clearRatings(showId),
    onSuccess: (data) => {
      queryClient.setQueryData(["show", String(showId)], data);
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      const cleared = {
        bfRating: null,
        gfRating: null,
        bfComment: "",
        gfComment: "",
      };
      setInitialState(cleared);
      setBfRating(null);
      setGfRating(null);
      setBfComment("");
      setGfComment("");
      setBfEditing(true);
      setGfEditing(true);
      toast.success("Ratings cleared.");
    },
    onError: () => {
      toast.error("Failed to clear ratings.");
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => api.refreshShow(showId),
    onSuccess: (data) => {
      queryClient.setQueryData(["show", String(showId)], data);
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast.success("TMDB refreshed.");
    },
    onError: () => {
      toast.error("Failed to refresh TMDB.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteShow(showId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast.success("Show deleted.");
      onBack();
    },
    onError: () => {
      toast.error("Failed to delete show.");
    },
  });

  const canEditPriority = show.status === "planned";
  const handlePrioritySave = () => {
    if (!priorityDirty) return;
    if (!canEditPriority) {
      toast.error("Priority only applies to planned shows.");
      return;
    }

    if (bfPriority !== null && (bfPriority < 1 || bfPriority > 5)) {
      toast.error("BF priority must be 1–5.");
      return;
    }
    if (gfPriority !== null && (gfPriority < 1 || gfPriority > 5)) {
      toast.error("GF priority must be 1–5.");
      return;
    }

    const payload: PriorityRequest = {};
    if (bfPriority !== initialPriority.bf) payload.bf_priority = bfPriority ?? 0;
    if (gfPriority !== initialPriority.gf) payload.gf_priority = gfPriority ?? 0;

    updatePriorityMutation.mutate(payload);
  };

  const tmdbUrl =
    show.tmdb_id && show.media_type
      ? `https://www.themoviedb.org/${show.media_type === "tv" ? "tv" : "movie"}/${show.tmdb_id}`
      : undefined;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          ← {backLabel}
        </Button>
      </div>

      <DetailHero
        show={show}
        imageBase={imageBase}
        imdbUrl={imdbUrl}
        tmdbUrl={tmdbUrl}
        onSetStatus={(status) => setStatusMutation.mutate(status)}
        statusPending={setStatusMutation.isPending}
        onRefresh={() => refreshMutation.mutate()}
        refreshPending={refreshMutation.isPending}
        onClearRatings={() => clearRatingsMutation.mutate()}
        clearPending={clearRatingsMutation.isPending}
      />

      <Card className="space-y-4 border-border/60 bg-card/70 p-6 shadow-lg lg:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg">Watch priority</h2>
            <p className="text-xs text-muted-foreground">
              Set 1–5 while planned. The list uses the average.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs">
            <span className="uppercase tracking-wide text-muted-foreground">Avg</span>
            <strong>{draftPrioritySummary?.label ?? "—"}</strong>
            {draftPrioritySummary?.warning ? (
              <span className="text-[0.65rem] text-destructive/80">Only one set</span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {bfName}
            </div>
            <PrioritySelector
              value={bfPriority}
              tone="bf"
              onChange={setBfPriority}
              disabled={!canEditPriority}
            />
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {gfName}
            </div>
            <PrioritySelector
              value={gfPriority}
              tone="gf"
              onChange={setGfPriority}
              disabled={!canEditPriority}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {canEditPriority
              ? "Leave blank to clear a priority."
              : "Priority is only available for planned shows."}
          </p>
          <Button
            variant="outline"
            onClick={handlePrioritySave}
            disabled={!canEditPriority || !priorityDirty || updatePriorityMutation.isPending}
          >
            Save priority
          </Button>
        </div>
      </Card>

      <DetailRatings
        bfName={bfName}
        gfName={gfName}
        bfRating={bfRating}
        gfRating={gfRating}
        bfComment={bfComment}
        gfComment={gfComment}
        bfEditing={bfEditing}
        gfEditing={gfEditing}
        onBfRatingChange={setBfRating}
        onGfRatingChange={setGfRating}
        onBfCommentChange={setBfComment}
        onGfCommentChange={setGfComment}
        onBfEditingChange={setBfEditing}
        onGfEditingChange={setGfEditing}
        average={combinedRating(bfRating, gfRating)}
        onRequestDelete={() => setPendingDelete(true)}
        onSave={() => updateMutation.mutate()}
        saveDisabled={!isDirty}
        savePending={updateMutation.isPending}
      />

      <AlertDialog open={pendingDelete} onOpenChange={setPendingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete show?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove “{show.title}” from your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
