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
import {
  DetailRatings,
  type Person,
  type RatingForm,
  type RatingForms,
} from "@/features/detail/detail-ratings";
import { DetailEpisodes } from "@/features/detail/detail-episodes";
import { DetailRelated } from "@/features/detail/detail-related";
import type { SearchPageSearch } from "@/features/search/search-utils";
import type { ApiShow, ApiShowDetail } from "@/lib/api";
import { api } from "@/lib/api";
import { onShowDeleted, queryKeys } from "@/lib/queries";
import { combinedRating, tmdbUrl } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

type DetailContentProps = {
  show: ApiShow;
  imageBase: string;
  imdbUrl?: string;
  bfName: string;
  gfName: string;
  backLabel: string;
  onBack: () => Promise<void>;
};

function ratingForm(rating: number | undefined, comment: string | undefined): RatingForm {
  // An empty comment opens in the editor, a written one as text with an edit
  // button.
  return { rating: rating ?? null, comment: comment ?? "", editing: !comment?.trim() };
}

const clearedForms: RatingForms = { bf: ratingForm(undefined, ""), gf: ratingForm(undefined, "") };

const sameRating = (a: RatingForm, b: RatingForm) =>
  a.rating === b.rating && a.comment.trim() === b.comment.trim();

export function DetailContent({
  show,
  imageBase,
  imdbUrl,
  bfName,
  gfName,
  backLabel,
  onBack,
}: DetailContentProps) {
  const queryClient = useQueryClient();
  const showId = show.id;
  const [pendingDelete, setPendingDelete] = useState(false);
  const [forms, setForms] = useState<RatingForms>(() => ({
    bf: ratingForm(show.bf_rating, show.bf_comment),
    gf: ratingForm(show.gf_rating, show.gf_comment),
  }));
  // What the server holds, to tell whether Save has anything to send.
  const [savedForms, setSavedForms] = useState(forms);
  const isDirty = !sameRating(forms.bf, savedForms.bf) || !sameRating(forms.gf, savedForms.gf);

  const updateForm = (person: Person, patch: Partial<RatingForm>) =>
    setForms((prev) => ({ ...prev, [person]: { ...prev[person], ...patch } }));

  // Each mutation answers with the updated show. Put it straight into the
  // detail cache and let the library lists refetch.
  const applyDetail = (data: ApiShowDetail) => {
    queryClient.setQueryData(queryKeys.show(showId), data);
    void queryClient.invalidateQueries({ queryKey: queryKeys.shows });
  };

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updateRatings(showId, {
        bf_rating: forms.bf.rating ?? undefined,
        gf_rating: forms.gf.rating ?? undefined,
        bf_comment: forms.bf.comment,
        gf_comment: forms.gf.comment,
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
      setForms(clearedForms);
      setSavedForms(clearedForms);
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

  const findSimilarSearch: SearchPageSearch = {
    media_type: show.media_type === "tv" ? "tv" : undefined,
    genre_names: show.genres.join(",") || undefined,
  };

  const watchOrderMutation = useMutation({
    mutationFn: (add: boolean) =>
      add ? api.addToWatchOrder(showId) : api.removeFromWatchOrder(showId),
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
    <section className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" className="-ml-3" onClick={() => void onBack()}>
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
        onAddToWatchOrder={() => watchOrderMutation.mutate(true)}
        onRemoveFromWatchOrder={() => watchOrderMutation.mutate(false)}
        watchOrderPending={watchOrderMutation.isPending}
        findSimilarSearch={findSimilarSearch}
      />

      <DetailRatings
        names={{ bf: bfName, gf: gfName }}
        forms={forms}
        onChange={updateForm}
        average={combinedRating(forms.bf.rating, forms.gf.rating)}
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
