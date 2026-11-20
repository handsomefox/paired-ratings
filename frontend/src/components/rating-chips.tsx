import { Badge } from "@/components/ui/badge";
import { combinedRating, ratingText } from "@/lib/utils";

type RatingChipsProps = {
  bfName: string;
  gfName: string;
  bfRating: number | undefined;
  gfRating: number | undefined;
};

// Each chip grows from the width of its text, so on a phone "AVG 8.8" gets
// the room that a short "★ 9" does not need.
const chipBase =
  "min-w-0 flex-auto justify-center gap-0.5 rounded-full border px-1 py-1 text-xs font-semibold tracking-tight sm:px-1.5";

export function RatingChips({ bfName, gfName, bfRating, gfRating }: RatingChipsProps) {
  return (
    <div className="flex w-full gap-1 text-xs sm:gap-2">
      <Badge variant="bf" className={chipBase}>
        <span aria-hidden="true">★</span>
        <span className="sr-only">{bfName}'s rating</span>
        <strong>{ratingText(bfRating)}</strong>
      </Badge>
      <Badge variant="gf" className={chipBase}>
        <span aria-hidden="true">★</span>
        <span className="sr-only">{gfName}'s rating</span>
        <strong>{ratingText(gfRating)}</strong>
      </Badge>
      <Badge
        variant="outline"
        // The label is smaller than the number, so centring their boxes would
        // put the label's baseline higher. Line them up on the baseline.
        className={`${chipBase} items-baseline border-border/60 bg-muted/40 text-foreground`}
      >
        <span className="text-[0.65rem] font-semibold tracking-wide">AVG</span>
        <strong>{combinedRating(bfRating, gfRating)}</strong>
      </Badge>
    </div>
  );
}
