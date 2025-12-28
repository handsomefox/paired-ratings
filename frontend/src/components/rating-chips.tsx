import { Badge } from "@/components/ui/badge";
import { combinedRating, ratingText } from "@/lib/utils";

type RatingChipsProps = {
  bfRating: number | null | undefined;
  gfRating: number | null | undefined;
};

const chipBase =
  "w-full justify-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold";

const RatingChips = ({ bfRating, gfRating }: RatingChipsProps) => (
  <div className="grid w-full grid-cols-3 gap-2 text-xs">
    <Badge variant="bf" className={chipBase}>
      <span>★</span>
      <strong>{ratingText(bfRating)}</strong>
    </Badge>
    <Badge variant="gf" className={chipBase}>
      <span>★</span>
      <strong>{ratingText(gfRating)}</strong>
    </Badge>
    <Badge variant="outline" className={`${chipBase} border-border/60 bg-muted/40 text-foreground`}>
      <span className="text-[0.65rem] font-semibold tracking-wide">AVG</span>
      <strong>{combinedRating(bfRating, gfRating)}</strong>
    </Badge>
  </div>
);

export default RatingChips;
