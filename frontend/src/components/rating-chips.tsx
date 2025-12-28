import { combinedRating, ratingText } from "@/lib/utils";

type RatingChipsProps = {
  bfRating: number | null | undefined;
  gfRating: number | null | undefined;
};

const chipBase =
  "inline-flex w-full items-center justify-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold";

const RatingChips = ({ bfRating, gfRating }: RatingChipsProps) => (
  <div className="grid w-full grid-cols-3 gap-2 text-xs">
    <div className={`${chipBase} border-teal-500/30 bg-teal-500/10 text-teal-200`}>
      <span>★</span>
      <strong>{ratingText(bfRating)}</strong>
    </div>
    <div className={`${chipBase} border-purple-500/30 bg-purple-500/10 text-purple-200`}>
      <span>★</span>
      <strong>{ratingText(gfRating)}</strong>
    </div>
    <div className={`${chipBase} border-border/60 bg-muted/40 text-foreground`}>
      <span className="text-[0.65rem] font-semibold tracking-wide">AVG</span>
      <strong>{combinedRating(bfRating, gfRating)}</strong>
    </div>
  </div>
);

export default RatingChips;
