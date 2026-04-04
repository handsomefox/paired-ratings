import CardGrid from "@/components/card-grid";
import { LanguageBadge } from "@/components/language-badge";
import { ShowCard } from "@/components/show-card";
import { TmdbRatingBadge } from "@/components/tmdb-rating-badge";
import { ViewTransitionLink } from "@/components/view-transition-link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { GetRelatedResponse, ListResponse, SearchResult } from "@/lib/api";
import { api } from "@/lib/api";
import { shortGenreList } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

type DetailRelatedProps = {
  showId: number;
  imageBase: string;
};

export function DetailRelated({ showId, imageBase }: DetailRelatedProps) {
  const queryClient = useQueryClient();

  const relatedQuery = useQuery<GetRelatedResponse>({
    queryKey: ["related", showId],
    queryFn: () => api.getRelated(showId),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const libraryQuery = useQuery<ListResponse>({
    queryKey: ["library-map"],
    queryFn: () => api.listShows(new URLSearchParams()),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });

  const libraryMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const show of libraryQuery.data?.shows ?? []) {
      map.set(`${show.media_type}:${show.tmdb_id}`, show.id);
    }
    return map;
  }, [libraryQuery.data]);

  const addMutation = useMutation({
    mutationFn: (item: SearchResult) =>
      api.addShow({
        tmdb_id: item.id,
        media_type: item.media_type,
        status: "planned",
      }),
    onSuccess: (_data, item) => {
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      queryClient.invalidateQueries({ queryKey: ["related", showId] });
      queryClient.invalidateQueries({ queryKey: ["library-map"] });
      toast.success(`Added "${item.title}" to library.`);
    },
    onError: () => {
      toast.error("Failed to add to library.");
    },
  });

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{collectionName ? collectionName : "Related"}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardGrid className="grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((item) => {
            const libraryId = libraryMap.get(`${item.media_type}:${item.id}`);
            return (
              <ShowCard
                key={`${item.media_type}:${item.id}`}
                title={item.title}
                year={item.year}
                posterAlt={item.title}
                posterPath={item.poster_path}
                imageBase={imageBase}
                posterLink={(node) => (
                  <a
                    href={`https://www.themoviedb.org/${item.media_type}/${item.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block"
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
                      label={item.original_language?.toUpperCase()}
                    />
                    <Badge variant="outline" className="flex justify-center">
                      {item.media_type === "movie"
                        ? "Movie"
                        : item.media_type === "tv"
                          ? "TV"
                          : item.media_type}
                    </Badge>
                  </>
                }
                metaBadgesClassName="grid-cols-2"
                genresText={item.genres?.length ? shortGenreList(item.genres) : ""}
                overview={item.overview}
                footer={
                  item.in_library ? (
                    libraryId ? (
                      <ViewTransitionLink
                        to="/show/$showId"
                        params={{ showId: String(libraryId) }}
                        className="block w-full"
                      >
                        <Badge
                          variant="outline"
                          className="h-8 w-full justify-center rounded-md border-primary/40 bg-primary/15 px-3 text-xs text-primary hover:bg-primary/20"
                        >
                          In library
                        </Badge>
                      </ViewTransitionLink>
                    ) : (
                      <Badge
                        variant="outline"
                        className="h-8 w-full justify-center rounded-md border-primary/40 bg-primary/15 px-3 text-xs text-primary"
                      >
                        In library
                      </Badge>
                    )
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-full text-xs"
                      onClick={() => addMutation.mutate(item)}
                      disabled={addMutation.isPending}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      Add
                    </Button>
                  )
                }
              />
            );
          })}
        </CardGrid>
      </CardContent>
    </Card>
  );
}
