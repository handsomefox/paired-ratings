import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { GetRelatedResponse, SearchResult } from "@/lib/api";
import { api } from "@/lib/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {results.map((item) => (
            <div
              key={`${item.media_type}:${item.id}`}
              className="group relative flex flex-col overflow-hidden rounded-lg border border-border/60 bg-card/60"
            >
              {item.poster_path ? (
                <img
                  src={`${imageBase}w300${item.poster_path}`}
                  alt={item.title}
                  className="aspect-[2/3] w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex aspect-[2/3] w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                  No poster
                </div>
              )}
              <div className="flex flex-1 flex-col gap-1 p-2">
                <span className="line-clamp-2 text-xs font-medium leading-tight">{item.title}</span>
                {item.year && (
                  <span className="text-[10px] text-muted-foreground">{item.year}</span>
                )}
                {item.in_library ? (
                  <span className="mt-auto text-[10px] font-medium text-primary">In library</span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-auto h-7 w-full text-xs"
                    onClick={() => addMutation.mutate(item)}
                    disabled={addMutation.isPending}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
