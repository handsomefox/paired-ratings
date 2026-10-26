import { ShowLink } from "@/components/show-link";
import { Badge } from "@/components/ui/badge";
import { cn, mediaTypeLabel } from "@/lib/utils";

/** "In library" on a TMDB result that is already saved, linking to its page. */
export function InLibraryLink({ libraryId }: { libraryId: number }) {
  return (
    <ShowLink showId={libraryId} className="block w-full">
      <Badge
        variant="outline"
        className="h-8 w-full justify-center gap-1 rounded-md border-primary/40 bg-primary/15 px-3 text-xs text-primary hover:bg-primary/20"
      >
        In library
      </Badge>
    </ShowLink>
  );
}

export function MediaTypeBadge({
  mediaType,
  fullWidth,
}: {
  mediaType: string;
  /** Spans both badge columns when the language badge beside it is missing. */
  fullWidth: boolean;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "flex justify-center",
        fullWidth ? "col-span-2 w-1/2 justify-self-center" : "w-full",
      )}
    >
      {mediaTypeLabel(mediaType)}
    </Badge>
  );
}
