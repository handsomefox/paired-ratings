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
  "min-w-0 flex-auto justify-center gap-0.5 rounded-full px-[5px] py-[5px] text-xs font-semibold tracking-tight sm:px-[7px]";

// The star's ink is centred on the digits' ink, but a five-pointed star looks
// lower than that: its middle is below the middle of its box. Half a pixel up
// makes it look centred.
function Star() {
  return (
    <span aria-hidden="true" className="-translate-y-[0.5px]">
      ★
    </span>
  );
}

export function RatingChips({ bfName, gfName, bfRating, gfRating }: RatingChipsProps) {
  return (
    <div className="flex w-full gap-1 text-xs sm:gap-2">
      <Badge variant="bf" className={chipBase}>
        <Star />
        <span className="sr-only">{bfName}'s rating</span>
        <strong>{ratingText(bfRating)}</strong>
      </Badge>
      <Badge variant="gf" className={chipBase}>
        <Star />
        <span className="sr-only">{gfName}'s rating</span>
        <strong>{ratingText(gfRating)}</strong>
      </Badge>
      <Badge
        variant="outline"
        // The label is smaller than the number, so centring their boxes would
        // put the label's baseline higher. Line them up on the baseline.
        className={`${chipBase} inset-ring-border/60 items-baseline bg-muted/40 text-foreground`}
      >
        <span className="text-[0.65rem] font-semibold tracking-wide">AVG</span>
        <strong>{combinedRating(bfRating, gfRating)}</strong>
      </Badge>
    </div>
  );
}
