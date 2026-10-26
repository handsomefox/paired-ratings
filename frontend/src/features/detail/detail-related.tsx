import { CardGrid } from "@/components/card-grid";
import { LanguageBadge } from "@/components/language-badge";
import { InLibraryLink, MediaTypeBadge } from "@/components/result-badges";
import { ShowCard } from "@/components/show-card";
import { TmdbRatingBadge } from "@/components/tmdb-rating-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { resultKey } from "@/features/search/search-utils";
import type { SearchResult } from "@/lib/api";
import { api } from "@/lib/api";
import { onShowAdded, queryKeys } from "@/lib/queries";
import { shortGenres, tmdbUrl } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

// Two rows at the widest layout. TMDB sends up to 20 recommendations, and
// showing them all makes the related section most of the page.
const INITIAL_COUNT = 10;

type DetailRelatedProps = {
  showId: number;
  imageBase: string;
};

export function DetailRelated({ showId, imageBase }: DetailRelatedProps) {
  const queryClient = useQueryClient();

  const relatedQuery = useQuery({
    queryKey: queryKeys.related(showId),
    queryFn: ({ signal }) => api.getRelated(showId, { signal }),
    staleTime: 60_000,
  });

  const addMutation = useMutation({
    mutationFn: (item: SearchResult) =>
      api.addShow({
        tmdb_id: item.id,
        media_type: item.media_type,
        status: "planned",
      }),
    onSuccess: (data, item) => {
      if (data.show) {
        onShowAdded(queryClient, {
          tmdbId: item.id,
          mediaType: item.media_type,
          libraryId: data.show.id,
        });
      }
      toast.success(`Added "${item.title}" to library.`);
    },
    onError: () => {
      toast.error("Failed to add to library.");
    },
  });

  const [showAll, setShowAll] = useState(false);

  if (relatedQuery.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Related</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const results = relatedQuery.data?.results ?? [];
  const collectionName = relatedQuery.data?.collection_name;

  if (results.length === 0) return null;

  const pendingKey = addMutation.isPending ? resultKey(addMutation.variables) : undefined;
  const shown = showAll ? results : results.slice(0, INITIAL_COUNT);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{collectionName || "Related"}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardGrid columns="grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {shown.map((item) => (
            <ShowCard
              key={resultKey(item)}
              title={item.title}
              year={item.year}
              posterAlt={item.title}
              posterPath={item.poster_path}
              imageBase={imageBase}
              posterLink={(node) => (
                <a
                  href={tmdbUrl(item.media_type, item.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                  aria-label={`Open ${item.title} on TMDB`}
                >
                  {node}
                </a>
              )}
              metaBadges={
                <>
                  <TmdbRatingBadge
                    rating={item.vote_average}
                    votes={item.vote_count}
                    className="col-span-2 flex w-full justify-center"
                  />
                  <LanguageBadge
                    code={item.original_language}
                    label={item.original_language.toUpperCase()}
                  />
                  <MediaTypeBadge mediaType={item.media_type} fullWidth={!item.original_language} />
                </>
              }
              genresText={shortGenres(item.genres)}
              overview={item.overview}
              footer={
                item.library_id ? (
                  <InLibraryLink libraryId={item.library_id} />
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-full text-xs"
                    onClick={() => addMutation.mutate(item)}
                    disabled={pendingKey === resultKey(item)}
                    aria-label={`Add ${item.title}`}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add
                  </Button>
                )
              }
            />
          ))}
        </CardGrid>
        {shown.length < results.length ? (
          <div className="mt-4 flex justify-center sm:mt-6">
            <Button variant="outline" onClick={() => setShowAll(true)}>
              Show all {results.length}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
