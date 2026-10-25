import { Loading } from "@/components/loading";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { DetailContent } from "@/features/detail/detail-content";
import { api, ApiError } from "@/lib/api";
import { queryKeys, useSession } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";

function backLabelForTarget(target: string | undefined): string {
  if (target?.startsWith("/search")) return "Back to search";
  if (target?.startsWith("/watch-order")) return "Back to watch order";
  return "Back to library";
}

export function DetailPage() {
  const { showId: showIdParam } = useParams({ from: "/show/$showId" });
  const showId = Number(showIdParam);
  const navigate = useNavigate();
  const { from: backTarget } = useSearch({ from: "/show/$showId" });
  const { imageBase, bfName, gfName } = useSession();

  const showQuery = useQuery({
    queryKey: queryKeys.show(showId),
    queryFn: ({ signal }) => api.getShow(showId, { signal }),
  });

  if (showQuery.isLoading) {
    return <Loading label="Loading..." />;
  }

  const show = showQuery.data?.show;
  if (!show) {
    const notFound =
      showQuery.isSuccess ||
      (showQuery.error instanceof ApiError && showQuery.error.status === 404);
    return (
      <Empty className="border-border/60 bg-card/30">
        <EmptyHeader>
          <EmptyTitle>{notFound ? "Show not found" : "Could not load this show"}</EmptyTitle>
          <EmptyDescription>
            {notFound ? "Try going back to the library." : "Reload the page to try again."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  // `from` is a full in-app href with its query string, validated by the
  // route. When `href` is set the router builds the location from it and
  // ignores `to`, which is only there to satisfy the types.
  const handleBack = () => navigate({ to: "/", href: backTarget });

  return (
    <DetailContent
      key={show.id}
      show={show}
      showId={showId}
      imageBase={imageBase}
      imdbUrl={showQuery.data?.imdb_url}
      bfName={bfName}
      gfName={gfName}
      backLabel={backLabelForTarget(backTarget)}
      onBack={handleBack}
    />
  );
}
