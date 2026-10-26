import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";

const ratingValues = Array.from({ length: 10 }, (_, index) => index + 1);

type StarRatingProps = {
  value: number | null;
  onChange: (value: number) => void;
  tone: "bf" | "gf";
  label: string;
};

function StarRating({ value, onChange, tone, label }: StarRatingProps) {
  return (
    // Each star stretches to an equal share of the row, so a phone gets
    // targets as wide as the screen allows rather than 22 px glyphs.
    <div role="group" aria-label={label} className="flex items-center">
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
              "flex h-10 flex-1 cursor-pointer items-center justify-center text-[24px] leading-none transition hover:-translate-y-0.5",
              active ? toneClass : idleClass,
            )}
            aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
            aria-pressed={value === rating}
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
      {/* Capped with the stars, so the number sits at their end. */}
      <div className="max-w-sm space-y-2">
        <div className="flex items-baseline justify-between text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rating
          <span className="normal-case tabular-nums">
            {rating === null ? "Not rated" : `${rating}/10`}
          </span>
        </div>
        <StarRating
          value={rating}
          onChange={onRatingChange}
          tone={tone}
          label={`${name}'s rating`}
        />
      </div>
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Comment
        </div>
        {editing ? (
          <Textarea
            rows={3}
            placeholder={`Leave a comment by ${name}`}
            aria-label={`${name}'s comment`}
            value={comment}
            onChange={(event) => onCommentChange(event.target.value)}
            variant={tone}
            className="resize-none"
          />
        ) : (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-dashed border-border/60 bg-card/60 px-3 py-2 text-sm text-muted-foreground">
            <p className="min-w-0 whitespace-pre-line break-words leading-relaxed">{comment}</p>
            <button
              type="button"
              onClick={() => onEditingChange(true)}
              aria-label={`Edit ${name}'s comment`}
              className="-my-1 shrink-0 cursor-pointer rounded-lg border border-border/60 p-2 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
            >
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
