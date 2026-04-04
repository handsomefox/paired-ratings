import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ratingValues = Array.from({ length: 10 }, (_, index) => index + 1);

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
        const toneClass = tone === "bf" ? "text-bf" : "text-gf";
        const idleClass = tone === "bf" ? "text-bf/30" : "text-gf/30";
        return (
          <button
            key={rating}
            type="button"
            onClick={() => onChange(rating)}
            className={cn(
              "cursor-pointer text-[22px] leading-none transition hover:-translate-y-0.5",
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

export type DetailRatingPanelProps = {
  tone: "bf" | "gf";
  name: string;
  rating: number | null;
  onRatingChange: (value: number) => void;
  comment: string;
  onCommentChange: (value: string) => void;
  editing: boolean;
  onEditingChange: (next: boolean) => void;
};

export function DetailRatingPanel({
  tone,
  name,
  rating,
  onRatingChange,
  comment,
  onCommentChange,
  editing,
  onEditingChange,
}: DetailRatingPanelProps) {
  const isBf = tone === "bf";
  return (
    <Card variant={tone} className="space-y-4 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Badge
          variant={tone}
          className="h-6 w-9 justify-center rounded-full px-0 text-xs font-bold uppercase"
        >
          {isBf ? "BF" : "GF"}
        </Badge>
        <span className={cn(isBf ? "text-bf" : "text-gf")}>{name}</span>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rating
        </div>
        <StarRating value={rating} onChange={onRatingChange} tone={tone} />
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Comment
        </div>
        {editing ? (
          <Textarea
            rows={3}
            placeholder={`Leave a comment by ${name}`}
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            variant={tone}
            className="resize-none"
          />
        ) : (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-dashed border-border/60 bg-card/60 px-3 py-2 text-sm text-muted-foreground">
            <p className="leading-relaxed">{comment}</p>
            <button
              type="button"
              onClick={() => onEditingChange(true)}
              className="cursor-pointer rounded-lg border border-border/60 px-2 py-1 text-xs uppercase tracking-wide text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
            >
              ✎
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
