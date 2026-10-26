import { Badge } from "@/components/ui/badge";
import { combinedRating, ratingText } from "@/lib/utils";

type RatingChipsProps = {
  bfName: string;
  gfName: string;
  bfRating: number | undefined;
  gfRating: number | undefined;
};

const chipBase =
  "w-full justify-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold";

export function RatingChips({ bfName, gfName, bfRating, gfRating }: RatingChipsProps) {
  return (
    <div className="grid w-full grid-cols-3 gap-2 text-xs">
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
        className={`${chipBase} border-border/60 bg-muted/40 text-foreground`}
      >
        <span className="text-[0.65rem] font-semibold tracking-wide">AVG</span>
        <strong>{combinedRating(bfRating, gfRating)}</strong>
      </Badge>
    </div>
  );
}
