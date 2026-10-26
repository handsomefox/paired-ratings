import { Loading } from "@/components/loading";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { DetailContent } from "@/features/detail/detail-content";
import { api, ApiError } from "@/lib/api";
import { queryKeys, useSession } from "@/lib/queries";
import { useQuery } from "@tanstack/react-query";
import { getRouteApi, useLocation, useNavigate, useRouter } from "@tanstack/react-router";

function backLabelForTarget(target: string | undefined): string {
  if (target?.startsWith("/search")) return "Back to search";
  if (target?.startsWith("/watch-order")) return "Back to watch order";
  if (target?.startsWith("/show/")) return "Back";
  return "Back to library";
}

const route = getRouteApi("/authed/show/$showId");

export function DetailPage() {
  const { showId: showIdParam } = route.useParams();
  const showId = Number(showIdParam);
  const router = useRouter();
  const navigate = useNavigate();
  const { from: backTarget } = route.useSearch();
  const linkedFrom = useLocation({ select: (location) => location.state.linkedFrom });
  const { imageBase, bfName, gfName } = useSession();

  const showQuery = useQuery({
    queryKey: queryKeys.show(showId),
    queryFn: ({ signal }) => api.getShow(showId, { signal }),
  });

  if (showQuery.isPending) {
    return <Loading />;
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

  // A link from inside the app records where it came from. Then the entry
  // before this one is that page, and going back in history returns to it
  // with its scroll position. A page opened any other way, such as from a
  // bookmark, gets a new entry for `from` instead.
  const handleBack = (): Promise<void> => {
    if (backTarget && linkedFrom === backTarget && router.history.canGoBack()) {
      return new Promise((resolve) => {
        const unsubscribe = router.subscribe("onResolved", () => {
          unsubscribe();
          resolve();
        });
        router.history.back();
      });
    }
    // When `href` is set the router builds the location from it and ignores
    // `to`, which is only there to satisfy the types.
    return navigate({ to: "/", href: backTarget });
  };

  return (
    <DetailContent
      key={show.id}
      show={show}
      imageBase={imageBase}
      imdbUrl={showQuery.data?.imdb_url}
      bfName={bfName}
      gfName={gfName}
      backLabel={backLabelForTarget(backTarget)}
      onBack={handleBack}
    />
  );
}
