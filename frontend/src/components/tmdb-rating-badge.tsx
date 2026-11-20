import { Badge } from "@/components/ui/badge";
import { cn, compactVotes, formatScore, tmdbRatingTone } from "@/lib/utils";

type TmdbRatingBadgeProps = {
  rating?: number | null;
  votes?: number | null;
  className?: string;
};

export function TmdbRatingBadge({ rating, votes, className }: TmdbRatingBadgeProps) {
  if (!rating || rating <= 0) {
    return (
      <Badge variant="outline" className={cn("gap-1", tmdbRatingTone(rating), className)}>
        N/A
      </Badge>
    );
  }

  // On a phone the badge is half a card wide. Inter has no condensed width,
  // so tighter tracking and padding, and "4.5K" for 4509, keep the text in.
  return (
    <Badge
      variant="outline"
      className={cn("gap-0.5 px-[7px] tracking-tight", tmdbRatingTone(rating), className)}
    >
      <span>{formatScore(rating)}</span>
      {votes ? (
        <span title={`${votes.toLocaleString()} votes`}>({compactVotes(votes)})</span>
      ) : null}
    </Badge>
  );
}
