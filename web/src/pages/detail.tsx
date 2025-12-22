import { Loading } from "@/components/loading";
import { OriginCountriesChip } from "@/components/origin-countries-chip";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import type { ApiShow } from "@/lib/api";
import { api } from "@/lib/api";
import { cn, combinedRating, formatScore, formatVotes } from "@/lib/utils";
import { withViewTransition } from "@/lib/view-transitions";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const ratingValues = Array.from({ length: 10 }, (_, index) => index + 1);

type DetailContentProps = {
  show: ApiShow;
  showId: number;
  imageBase: string;
  imdbUrl?: string;
  bfName: string;
  gfName: string;
  originCountry: string[];
  onBack: () => void;
};

type StarRatingProps = {
  value: number | null;
  onChange: (value: number) => void;
  tone: "bf" | "gf";
};

function StarRating({ value, onChange, tone }: StarRatingProps) {
  return (
    <div className="flex items-center gap-1 pr-1">
      {ratingValues.map((rating) => {
        const active = value !== null && rating <= value;
        const toneClass = tone === "bf" ? "text-teal-300" : "text-purple-300";
        const idleClass = tone === "bf" ? "text-teal-400/30" : "text-purple-400/30";
        return (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            className={cn(
              "text-[22px] leading-none transition hover:-translate-y-0.5",
              active ? toneClass : idleClass,
            )}
            aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

function DetailContent({
  show,
  showId,
  imageBase,
  imdbUrl,
  bfName,
  gfName,
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

  const toggleStatusMutation = useMutation({
    mutationFn: () => api.toggleStatus(showId),
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

  const statusTone =
    show.status === "watched"
      ? "bg-teal-500/15 text-teal-200 border-teal-500/40"
      : show.status === "planned"
        ? "bg-purple-500/15 text-purple-200 border-purple-500/40"
        : "bg-muted text-muted-foreground border-border/60";
  const tmdbUrl =
    show.tmdb_id && show.media_type
      ? `https://www.themoviedb.org/${show.media_type === "tv" ? "tv" : "movie"}/${show.tmdb_id}`
      : undefined;

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={onBack}>
          ← Back to library
        </Button>
      </div>

      <div className="border-border/60 bg-card/70 grid gap-6 rounded-2xl border shadow-lg lg:grid-cols-[minmax(220px,300px)_minmax(0,1fr)]">
        <div className="bg-muted/40 overflow-hidden">
          <div className="aspect-[2/3] overflow-hidden">
            {show.poster_path ? (
              <img
                src={`${imageBase}${show.poster_path}`}
                alt={show.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center text-xs tracking-wide uppercase">
                No poster
              </div>
            )}
          </div>
        </div>
        <div className="space-y-6 p-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl">{show.title}</h1>
              {show.year ? (
                <span className="text-muted-foreground text-sm">{show.year}</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <OriginCountriesChip codes={show.origin_country} />
              <button
                type="button"
                className={cn(
                  "rounded-full border px-2 py-0.5 tracking-wide uppercase transition hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06)] hover:brightness-110",
                  statusTone,
                )}
                onClick={() => toggleStatusMutation.mutate()}
                disabled={toggleStatusMutation.isPending}
              >
                {show.status || "tbd"}
              </button>
              {show.genres ? <span className="text-muted-foreground">{show.genres}</span> : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {imdbUrl ? (
              <a
                href={imdbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border/60 bg-card/60 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase transition hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06)] hover:brightness-110"
              >
                IMDb
              </a>
            ) : null}
            {tmdbUrl ? (
              <a
                href={tmdbUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border-border/60 bg-card/60 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase transition hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06)] hover:brightness-110"
              >
                TMDB
                <span className="text-muted-foreground font-normal normal-case">
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
            ) : (
              <span className="border-border/60 bg-card/60 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-wide uppercase">
                TMDB
                <span className="text-muted-foreground font-normal normal-case">
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
            )}
            <button
              type="button"
              onClick={() => refreshMutation.mutate()}
              className="border-border/60 bg-card/60 inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06)] hover:brightness-110"
            >
              Refresh TMDB
            </button>
            <button
              type="button"
              onClick={() => clearRatingsMutation.mutate()}
              className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-200 transition hover:bg-red-500/20 hover:text-red-100"
            >
              Clear ratings
            </button>
          </div>

          {show.overview ? <p className="text-muted-foreground text-sm">{show.overview}</p> : null}
        </div>
      </div>

      <div className="border-border/60 bg-card/70 rounded-2xl border p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg">Ratings</h2>
            <p className="text-muted-foreground text-xs">1–10, add a note if you want</p>
          </div>
          <div className="border-border/60 bg-muted/40 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
            <span className="text-muted-foreground tracking-wide uppercase">Avg</span>
            <strong>{combinedRating(bfRating, gfRating)}</strong>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-teal-500/40 bg-teal-500/5 p-4 shadow-[0_0_0_1px_rgba(20,184,166,0.2)]">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="inline-flex h-6 w-9 items-center justify-center rounded-full bg-teal-500/20 text-xs font-bold text-teal-200 uppercase">
                BF
              </span>
              <span className="text-teal-200">{bfName}</span>
            </div>
            <div className="space-y-2">
              <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Rating
              </div>
              <StarRating value={bfRating} onChange={setBfRating} tone="bf" />
            </div>
            <div className="space-y-2">
              <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Comment
              </div>
              {bfEditing ? (
                <Textarea
                  rows={3}
                  placeholder={`Leave a comment by ${bfName}`}
                  value={bfComment}
                  onChange={(event) => setBfComment(event.target.value)}
                  className="resize-none border-teal-500/40 focus-visible:ring-2 focus-visible:ring-teal-400/60"
                />
              ) : (
                <div className="border-border/60 bg-card/60 text-muted-foreground flex items-start justify-between gap-3 rounded-xl border border-dashed px-3 py-2 text-sm">
                  <p className="leading-relaxed">{bfComment}</p>
                  <button
                    type="button"
                    onClick={() => setBfEditing(true)}
                    className="border-border/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground rounded-lg border px-2 py-1 text-xs tracking-wide uppercase transition"
                  >
                    ✎
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-purple-500/40 bg-purple-500/5 p-4 shadow-[0_0_0_1px_rgba(168,85,247,0.2)]">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <span className="inline-flex h-6 w-9 items-center justify-center rounded-full bg-purple-500/20 text-xs font-bold text-purple-200 uppercase">
                GF
              </span>
              <span className="text-purple-200">{gfName}</span>
            </div>
            <div className="space-y-2">
              <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Rating
              </div>
              <StarRating value={gfRating} onChange={setGfRating} tone="gf" />
            </div>
            <div className="space-y-2">
              <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Comment
              </div>
              {gfEditing ? (
                <Textarea
                  rows={3}
                  placeholder={`Leave a comment by ${gfName}`}
                  value={gfComment}
                  onChange={(event) => setGfComment(event.target.value)}
                  className="resize-none border-purple-500/40 focus-visible:ring-2 focus-visible:ring-purple-400/60"
                />
              ) : (
                <div className="border-border/60 bg-card/60 text-muted-foreground flex items-start justify-between gap-3 rounded-xl border border-dashed px-3 py-2 text-sm">
                  <p className="leading-relaxed">{gfComment}</p>
                  <button
                    type="button"
                    onClick={() => setGfEditing(true)}
                    className="border-border/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground rounded-lg border px-2 py-1 text-xs tracking-wide uppercase transition"
                  >
                    ✎
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
            onClick={() => setPendingDelete(true)}
          >
            Delete
          </Button>
          <Button
            className="bg-purple-500/20 text-purple-100 hover:bg-purple-500/30"
            onClick={() => updateMutation.mutate()}
            disabled={!isDirty || updateMutation.isPending}
          >
            Save ratings
          </Button>
        </div>
      </div>

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

export function DetailPage() {
  const { showId } = useParams({ from: "/show/$showId" });
  const navigate = useNavigate();

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: api.session,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });

  const showQuery = useQuery({
    queryKey: ["show", showId],
    queryFn: () => api.getShow(Number(showId)),
  });

  const imageBase = sessionQuery.data?.image_base ?? "";
  const bfName = sessionQuery.data?.bf_name ?? "BF";
  const gfName = sessionQuery.data?.gf_name ?? "GF";

  if (showQuery.isLoading) {
    return <Loading label="Loading..." />;
  }

  const show = showQuery.data?.show;
  if (!show) {
    return (
      <Empty className="border-border/60 bg-card/30">
        <EmptyHeader>
          <EmptyTitle>Show not found</EmptyTitle>
          <EmptyDescription>Try going back to the library.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <DetailContent
      key={show.id}
      show={show}
      showId={Number(showId)}
      imageBase={imageBase}
      originCountry={show.origin_country}
      imdbUrl={showQuery.data?.imdb_url}
      bfName={bfName}
      gfName={gfName}
      onBack={() =>
        withViewTransition(() => {
          void navigate({ to: "/" });
        })
      }
    />
  );
}
