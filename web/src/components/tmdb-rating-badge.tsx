import { Badge } from "@/components/ui/badge";
import { cn, formatScore, formatVotes, tmdbRatingTone } from "@/lib/utils";

type TmdbRatingBadgeProps = {
  rating?: number | null;
  votes?: number | null;
  className?: string;
};

export function TmdbRatingBadge({ rating, votes, className }: TmdbRatingBadgeProps) {
  if (!rating || rating <= 0) {
    return (
      <Badge variant="outline" className={cn("gap-1", tmdbRatingTone(rating), className)}>
        No TMDB score
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn("gap-1", tmdbRatingTone(rating), className)}>
      <span>{formatScore(rating)}</span>
      {votes ? <span>({formatVotes(votes)})</span> : null}
    </Badge>
  );
}
