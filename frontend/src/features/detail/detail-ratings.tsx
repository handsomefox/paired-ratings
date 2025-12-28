import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DetailRatingPanel } from "@/features/detail/detail-rating-panel";

export type DetailRatingsProps = {
  bfName: string;
  gfName: string;
  bfRating: number | null;
  gfRating: number | null;
  bfComment: string;
  gfComment: string;
  bfEditing: boolean;
  gfEditing: boolean;
  onBfRatingChange: (value: number) => void;
  onGfRatingChange: (value: number) => void;
  onBfCommentChange: (value: string) => void;
  onGfCommentChange: (value: string) => void;
  onBfEditingChange: (next: boolean) => void;
  onGfEditingChange: (next: boolean) => void;
  average: string;
  onRequestDelete: () => void;
  onSave: () => void;
  saveDisabled: boolean;
  savePending: boolean;
};

export function DetailRatings({
  bfName,
  gfName,
  bfRating,
  gfRating,
  bfComment,
  gfComment,
  bfEditing,
  gfEditing,
  onBfRatingChange,
  onGfRatingChange,
  onBfCommentChange,
  onGfCommentChange,
  onBfEditingChange,
  onGfEditingChange,
  average,
  onRequestDelete,
  onSave,
  saveDisabled,
  savePending,
}: DetailRatingsProps) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-6 shadow-lg lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg">Ratings</h2>
          <p className="text-xs text-muted-foreground">1–10, add a note if you want</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs">
          <span className="uppercase tracking-wide text-muted-foreground">Avg</span>
          <strong>{average}</strong>
        </div>
      </div>

      <Separator className="my-6" />

      <div className="grid gap-6 lg:grid-cols-2">
        <DetailRatingPanel
          tone="bf"
          name={bfName}
          rating={bfRating}
          onRatingChange={onBfRatingChange}
          comment={bfComment}
          onCommentChange={onBfCommentChange}
          editing={bfEditing}
          onEditingChange={onBfEditingChange}
        />
        <DetailRatingPanel
          tone="gf"
          name={gfName}
          rating={gfRating}
          onRatingChange={onGfRatingChange}
          comment={gfComment}
          onCommentChange={onGfCommentChange}
          editing={gfEditing}
          onEditingChange={onGfEditingChange}
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          className="text-red-300 hover:bg-red-500/10 hover:text-red-200"
          onClick={onRequestDelete}
        >
          Delete
        </Button>
        <Button variant="gf" onClick={onSave} disabled={saveDisabled || savePending}>
          Save ratings
        </Button>
      </div>
    </div>
  );
}
