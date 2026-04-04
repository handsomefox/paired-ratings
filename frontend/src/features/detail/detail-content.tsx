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
import type { ApiShow } from "@/lib/api";
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
  const isDirty = useMemo(() => {
    return (
      bfRating !== initialState.bfRating ||
      gfRating !== initialState.gfRating ||
      bfComment.trim() !== initialState.bfComment.trim() ||
      gfComment.trim() !== initialState.gfComment.trim()
    );
  }, [bfRating, gfRating, bfComment, gfComment, initialState]);

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

      {show.media_type === "tv" && (
        <DetailEpisodes showId={showId} bfName={bfName} gfName={gfName} />
      )}

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
