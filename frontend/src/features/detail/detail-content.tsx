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
import { DetailHero } from "@/features/detail/detail-hero";
import { DetailRatings } from "@/features/detail/detail-ratings";
import { DetailEpisodes } from "@/features/detail/detail-episodes";
import { DetailRelated } from "@/features/detail/detail-related";
import type { ApiShow, ApiShowDetail } from "@/lib/api";
import { api } from "@/lib/api";
import { onShowDeleted, queryKeys } from "@/lib/queries";
import { combinedRating, tmdbUrl } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

export type DetailContentProps = {
  show: ApiShow;
  showId: number;
  imageBase: string;
  imdbUrl?: string;
  bfName: string;
  gfName: string;
  backLabel: string;
  onBack: () => Promise<void>;
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
  const isDirty =
    bfRating !== initialState.bfRating ||
    gfRating !== initialState.gfRating ||
    bfComment.trim() !== initialState.bfComment.trim() ||
    gfComment.trim() !== initialState.gfComment.trim();

  // Each mutation answers with the updated show. Put it straight into the
  // detail cache and let the library lists refetch.
  const applyDetail = (data: ApiShowDetail) => {
    queryClient.setQueryData(queryKeys.show(showId), data);
    void queryClient.invalidateQueries({ queryKey: queryKeys.shows });
  };

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateRatings(showId, {
        bf_rating: bfRating ?? undefined,
        gf_rating: gfRating ?? undefined,
        bf_comment: bfComment,
        gf_comment: gfComment,
      }),
    onSuccess: (data) => {
      applyDetail(data);
      toast.success("Ratings saved.");
      // Saving leaves the page, so the local form state is not reset here.
      void onBack();
    },
    onError: () => {
      toast.error("Failed to save ratings.");
    },
  });

  const setStatusMutation = useMutation({
    mutationFn: (status: string) => api.setStatus(showId, status),
    onSuccess: (data) => {
      applyDetail(data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.episodes(showId) });
      toast.success(`Marked ${data.show?.status ?? "updated"}.`);
    },
    onError: () => {
      toast.error("Failed to update status.");
    },
  });

  const clearRatingsMutation = useMutation({
    mutationFn: () => api.clearRatings(showId),
    onSuccess: (data) => {
      applyDetail(data);
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
      applyDetail(data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.episodes(showId) });
      toast.success("TMDB refreshed.");
    },
    onError: () => {
      toast.error("Failed to refresh TMDB.");
    },
  });

  const genreNames = show.genres.join(",");
  const findSimilarSearch = {
    media_type: show.media_type,
    ...(genreNames ? { genre_names: genreNames } : {}),
  };

  const watchOrderMutation = useMutation({
    mutationFn: (inWatchOrder: boolean) =>
      inWatchOrder ? api.removeFromWatchOrder(showId) : api.addToWatchOrder(showId),
    onSuccess: (data) => {
      applyDetail(data);
      const added = data.show?.watch_priority != null;
      toast.success(added ? "Added to watch order." : "Removed from watch order.");
    },
    onError: () => {
      toast.error("Failed to update watch order.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteShow(showId),
    onSuccess: async () => {
      toast.success("Show deleted.");
      // Leave the page first. Dropping its cache entry while it is still
      // mounted would make it refetch the show that no longer exists.
      await onBack();
      onShowDeleted(queryClient, showId);
    },
    onError: () => {
      toast.error("Failed to delete show.");
    },
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => void onBack()}>
          ← {backLabel}
        </Button>
      </div>

      <DetailHero
        show={show}
        imageBase={imageBase}
        imdbUrl={imdbUrl}
        tmdbUrl={show.tmdb_id ? tmdbUrl(show.media_type, show.tmdb_id) : undefined}
        onSetStatus={(status) => setStatusMutation.mutate(status)}
        statusPending={setStatusMutation.isPending}
        onRefresh={() => refreshMutation.mutate()}
        refreshPending={refreshMutation.isPending}
        onRequestDelete={() => setPendingDelete(true)}
        onAddToWatchOrder={() => watchOrderMutation.mutate(false)}
        onRemoveFromWatchOrder={() => watchOrderMutation.mutate(true)}
        watchOrderPending={watchOrderMutation.isPending}
        findSimilarSearch={findSimilarSearch}
      />

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
        onClearRatings={() => clearRatingsMutation.mutate()}
        clearPending={clearRatingsMutation.isPending}
        onSave={() => updateMutation.mutate()}
        saveDisabled={!isDirty}
        savePending={updateMutation.isPending}
      />

      {show.media_type === "tv" && <DetailEpisodes showId={showId} />}

      <DetailRelated showId={showId} imageBase={imageBase} />

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
