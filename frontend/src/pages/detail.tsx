import { Loading } from "@/components/loading";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { DetailContent } from "@/features/detail/detail-content";
import { api } from "@/lib/api";
import { withViewTransition } from "@/lib/view-transitions";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";

function backLabelForTarget(target: string | null): string {
  if (target?.startsWith("/search")) return "Back to search";
  if (target?.startsWith("/watch-order")) return "Back to watch order";
  return "Back to library";
}

type DetailSearch = {
  from?: string;
};

export function DetailPage() {
  const { showId } = useParams({ from: "/show/$showId" });
  const navigate = useNavigate();
  const search = useSearch({ from: "/show/$showId" }) as DetailSearch;

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: api.session,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });

  const showQuery = useQuery({
    queryKey: ["show", showId],
    queryFn: () => api.getShow(Number(showId)),
  });

  const imageBase = sessionQuery.data?.image_base ?? "";
  const bfName = sessionQuery.data?.bf_name ?? "BF";
  const gfName = sessionQuery.data?.gf_name ?? "GF";
  const backTarget = search.from ?? null;
  const backLabel = backLabelForTarget(backTarget);

  if (showQuery.isLoading) {
    return <Loading label="Loading..." />;
  }

  const show = showQuery.data?.show;
  if (!show) {
    return (
      <Empty className="border-border/60 bg-card/30">
        <EmptyHeader>
          <EmptyTitle>Show not found</EmptyTitle>
          <EmptyDescription>Try going back to the library.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const handleBack = () => {
    withViewTransition(() => {
      if (backTarget) {
        void navigate({ to: backTarget });
      } else {
        void navigate({ to: "/" });
      }
    });
  };

  return (
    <DetailContent
      key={show.id}
      show={show}
      showId={Number(showId)}
      imageBase={imageBase}
      imdbUrl={showQuery.data?.imdb_url}
      bfName={bfName}
      gfName={gfName}
      backLabel={backLabel}
      onBack={handleBack}
    />
  );
}
