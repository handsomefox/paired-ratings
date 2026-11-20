import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";

const stars = Array.from({ length: 10 }, (_, index) => index + 1);

const MIN_RATING = 0.5;
const MAX_RATING = 10;

const starLabel = (rating: number) => `${rating} star${rating === 1 ? "" : "s"}`;

type StarRatingProps = {
  value: number | null;
  onChange: (value: number) => void;
  tone: "bf" | "gf";
  label: string;
};

/**
 * Ten stars, each split into a left half and a right half, so a rating goes
 * from 0.5 to 10 in steps of 0.5. It is a radio group: Tab reaches the
 * current rating, and the arrow keys move it half a star at a time.
 */
function StarRating({ value, onChange, tone, label }: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const radios = useRef(new Map<number, HTMLButtonElement>());
  const shown = hovered ?? value ?? 0;
  const tabStop = value ?? MIN_RATING;
  const toneClass = tone === "bf" ? "text-bf" : "text-gf";
  const idleClass = tone === "bf" ? "text-bf/30" : "text-gf/30";

  const moveTo = (rating: number) => {
    const next = Math.min(MAX_RATING, Math.max(MIN_RATING, rating));
    onChange(next);
    radios.current.get(next)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, rating: number) => {
    const target = {
      ArrowRight: rating + 0.5,
      ArrowUp: rating + 0.5,
      ArrowLeft: rating - 0.5,
      ArrowDown: rating - 0.5,
      Home: MIN_RATING,
      End: MAX_RATING,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    moveTo(target);
  };

  return (
    // Each star stretches to an equal share of the row, so a phone gets
    // targets as wide as the screen allows rather than 22 px glyphs.
    <div role="radiogroup" aria-label={label} className="flex items-center">
      {stars.map((star) => {
        const fill = shown >= star ? "100%" : shown >= star - 0.5 ? "50%" : "0%";
        return (
          <div
            key={star}
            className="group relative flex h-10 flex-1 items-center justify-center text-[24px] leading-none sm:text-[28px]"
          >
            <span
              aria-hidden="true"
              className="relative inline-block transition group-hover:-translate-y-0.5"
            >
              <span className={idleClass}>★</span>
              <span
                className={cn("absolute inset-y-0 left-0 overflow-hidden", toneClass)}
                style={{ width: fill }}
              >
                ★
              </span>
            </span>
            {[star - 0.5, star].map((rating) => (
              <button
                key={rating}
                ref={(node) => {
                  if (node) radios.current.set(rating, node);
                  else radios.current.delete(rating);
                }}
                type="button"
                role="radio"
                aria-checked={value === rating}
                aria-label={starLabel(rating)}
                tabIndex={rating === tabStop ? 0 : -1}
                onClick={() => onChange(rating)}
                // Moving between halves leaves one radio and enters the next in
                // the same frame, so the preview does not flicker.
                onMouseEnter={() => setHovered(rating)}
                onMouseLeave={() => setHovered(null)}
                onKeyDown={(event) => handleKeyDown(event, rating)}
                className={cn(
                  "absolute inset-y-0 w-1/2 cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  rating === star ? "right-0" : "left-0",
                )}
              />
            ))}
          </div>
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
      {/* The stars span the panel, so the number sits at their end and at the
          edge of the panel, on a phone and on a wide screen alike. */}
      <div className="space-y-2">
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
