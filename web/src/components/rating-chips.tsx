import { combinedRating, ratingText } from "@/lib/utils";

type RatingChipsProps = {
  bfRating: number | null | undefined;
  gfRating: number | null | undefined;
};

const RatingChips = ({ bfRating, gfRating }: RatingChipsProps) => (
  <div className="flex flex-wrap items-center gap-2 text-xs">
    <div className="inline-flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-2.5 py-1 text-teal-200">
      <span>★</span>
      <strong>{ratingText(bfRating)}</strong>
    </div>
    <div className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-purple-200">
      <span>★</span>
      <strong>{ratingText(gfRating)}</strong>
    </div>
    <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-foreground">
      <span className="text-[0.65rem] font-semibold tracking-wide">AVG</span>
      <strong>{combinedRating(bfRating, gfRating)}</strong>
    </div>
  </div>
);

export default RatingChips;
