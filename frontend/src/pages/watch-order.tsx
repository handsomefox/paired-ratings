import { LoadingGrid } from "@/components/loading-grid";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { ViewTransitionLink } from "@/components/view-transition-link";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { ApiShow } from "@/lib/api";
import { api } from "@/lib/api";
import { shortGenres } from "@/lib/utils";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Film, GripVertical } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function SortableRow({
  show,
  index,
  imageBase,
  onDelete,
}: {
  show: ApiShow;
  index: number;
  imageBase: string;
  onDelete: (show: ApiShow) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: show.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const posterUrl = show.poster_path ? `${imageBase}${show.poster_path}` : "";
  const genres = show.genres ? shortGenres(show.genres) : "";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 border-b border-border/60 bg-card/70 px-4 py-3 last:border-0"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <span className="w-6 shrink-0 text-center text-xs font-semibold tabular-nums text-muted-foreground">
        {index + 1}
      </span>

      <ViewTransitionLink
        to="/show/$showId"
        params={{ showId: String(show.id) }}
        search={{ from: "/watch-order" }}
        className="overflow-hidden rounded-lg border border-border/60"
      >
        {posterUrl ? (
          <img src={posterUrl} alt={show.title} className="h-14 w-10 object-cover" loading="lazy" />
        ) : (
          <div className="flex h-14 w-10 items-center justify-center bg-muted/50 text-[10px] uppercase text-muted-foreground">
            —
          </div>
        )}
      </ViewTransitionLink>

      <div className="min-w-0 flex-1 space-y-0.5">
        <ViewTransitionLink
          to="/show/$showId"
          params={{ showId: String(show.id) }}
          search={{ from: "/watch-order" }}
          className="block truncate font-medium text-foreground hover:text-primary"
        >
          {show.title}
        </ViewTransitionLink>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {show.year ? <span>{show.year}</span> : null}
          {genres ? <span className="truncate">{genres}</span> : null}
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 text-muted-foreground/60 hover:text-destructive"
        onClick={() => onDelete(show)}
      >
        Delete
      </Button>
    </div>
  );
}

export function WatchOrderPage() {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<ApiShow | null>(null);
  const [localOrder, setLocalOrder] = useState<number[] | null>(null);

  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: api.session,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    retry: 1,
  });

  const params = useMemo(() => {
    const p = new URLSearchParams();
    p.set("status", "planned");
    p.set("sort", "priority");
    return p;
  }, []);

  const showsQuery = useQuery({
    queryKey: ["shows", params.toString()],
    queryFn: () => api.listShows(params),
    placeholderData: keepPreviousData,
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: number[]) => api.reorderShows(orderedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      setLocalOrder(null);
      toast.success("Order saved.");
    },
    onError: () => {
      toast.error("Failed to save order.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteShow(id),
    onSuccess: () => {
      setPendingDelete(null);
      setLocalOrder(null);
      queryClient.invalidateQueries({ queryKey: ["shows"] });
      toast.success("Show deleted.");
    },
    onError: () => {
      toast.error("Failed to delete show.");
    },
  });

  const serverShows = showsQuery.data?.shows ?? [];
  const imageBase = sessionQuery.data?.image_base ?? "";

  // Display order: use local drag state if present, otherwise server order
  const displayShows = useMemo(() => {
    if (!localOrder) return serverShows;
    const byId = new Map(serverShows.map((s) => [s.id, s]));
    return localOrder.flatMap((id) => {
      const show = byId.get(id);
      return show ? [show] : [];
    });
  }, [serverShows, localOrder]);

  const isDirty = localOrder !== null;
  const isInitialLoading = showsQuery.isLoading || (showsQuery.isFetching && serverShows.length === 0);
  const isEmpty = !showsQuery.isLoading && !showsQuery.isFetching && serverShows.length === 0;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentIds = displayShows.map((s) => s.id);
    const oldIndex = currentIds.indexOf(active.id as number);
    const newIndex = currentIds.indexOf(over.id as number);
    setLocalOrder(arrayMove(currentIds, oldIndex, newIndex));
  };

  const handleSave = () => {
    const ids = displayShows.map((s) => s.id);
    reorderMutation.mutate(ids);
  };

  return (
    <PullToRefresh onRefresh={() => queryClient.invalidateQueries({ queryKey: ["shows"] })}>
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-display text-xl sm:text-2xl">Watch order</h1>
          <p className="text-sm text-muted-foreground">
            Drag to reorder your planned shows.
          </p>
        </div>
        {isDirty ? (
          <Button onClick={handleSave} disabled={reorderMutation.isPending}>
            Save order
          </Button>
        ) : null}
      </div>

      {isInitialLoading ? <LoadingGrid /> : null}

      {isEmpty ? (
        <Empty className="border-border/60 bg-card/30">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Film />
            </EmptyMedia>
            <EmptyTitle>No planned shows yet</EmptyTitle>
            <EmptyDescription>Add something in the library first.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {displayShows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-border/60 shadow-lg">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={displayShows.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {displayShows.map((show, index) => (
                <SortableRow
                  key={show.id}
                  show={show}
                  index={index}
                  imageBase={imageBase}
                  onDelete={setPendingDelete}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      ) : null}

      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete show?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove "{pendingDelete?.title}" from your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
    </PullToRefresh>
  );
}
