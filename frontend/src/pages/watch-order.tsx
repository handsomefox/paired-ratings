import { LoadingGrid } from "@/components/loading-grid";
import { PullToRefresh } from "@/components/pull-to-refresh";
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
import { listState, queryKeys, useSession } from "@/lib/queries";
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
import { Link } from "@tanstack/react-router";
import { CircleAlert, Film, GripVertical } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";

// The whole watch order on one page. The default page size of 20 would hide
// the rest of the list and leave it out of a reorder.
const WATCH_ORDER_PARAMS = new URLSearchParams({ sort: "priority", page_size: "all" });

function SortableRow({
  show,
  index,
  total,
  imageBase,
  onDelete,
  onMoveToPosition,
}: {
  show: ApiShow;
  index: number;
  total: number;
  imageBase: string;
  onDelete: (show: ApiShow) => void;
  onMoveToPosition: (show: ApiShow, newIndex: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: show.id,
  });
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  // Escape hides the input, which blurs it. The blur must not commit the move.
  const cancelledRef = useRef(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const posterUrl = show.poster_path ? `${imageBase}${show.poster_path}` : "";
  const genres = shortGenres(show.genres);

  const startEditing = () => {
    cancelledRef.current = false;
    // Focus must be called synchronously from the user gesture so mobile
    // browsers open the keyboard. The input is always in the DOM, but it is
    // `invisible` until `editing` is committed, and a hidden element cannot
    // take focus. flushSync commits the render before focus() runs.
    flushSync(() => {
      setInputValue(String(index + 1));
      setEditing(true);
    });
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const cancelEdit = () => {
    cancelledRef.current = true;
    setEditing(false);
  };

  const commitEdit = () => {
    if (!editing || cancelledRef.current) return;
    setEditing(false);
    const parsed = parseInt(inputValue, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.max(1, Math.min(total, parsed));
      onMoveToPosition(show, clamped - 1);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 border-b border-border/60 bg-card/70 px-4 py-3 last:border-0"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onContextMenu={(e) => e.preventDefault()}
        className="cursor-grab touch-none text-muted-foreground/60 hover:text-muted-foreground active:cursor-grabbing"
        aria-label={`Drag ${show.title} to reorder`}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Both elements stay in the DOM so focus() can be called synchronously
          from the click handler, which is required for mobile keyboards. */}
      <div className="relative w-6 shrink-0">
        <button
          type="button"
          onClick={startEditing}
          aria-label={`Position ${index + 1}. Change position of ${show.title}`}
          className={`w-full cursor-pointer text-center text-xs font-semibold tabular-nums text-muted-foreground hover:text-primary ${editing ? "invisible" : ""}`}
        >
          {index + 1}
        </button>
        <input
          ref={inputRef}
          aria-label={`New position for ${show.title}`}
          tabIndex={editing ? 0 : -1}
          type="number"
          inputMode="numeric"
          min={1}
          max={total}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            else if (e.key === "Escape") cancelEdit();
          }}
          className={`absolute inset-0 w-full rounded border border-primary bg-background text-center text-xs font-semibold tabular-nums text-foreground outline-none ${editing ? "" : "invisible"}`}
        />
      </div>

      {/* The title link below is the one in the tab order. */}
      <Link
        to="/show/$showId"
        params={{ showId: String(show.id) }}
        search={{ from: "/watch-order" }}
        className="overflow-hidden rounded-lg border border-border/60"
        tabIndex={-1}
        aria-hidden="true"
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={show.title}
            className="h-14 w-10 object-cover md:h-28 md:w-20"
            loading="lazy"
          />
        ) : (
          <div className="flex h-14 w-10 items-center justify-center bg-muted/50 text-[10px] uppercase text-muted-foreground md:h-28 md:w-20">
            —
          </div>
        )}
      </Link>

      <div className="min-w-0 flex-1 space-y-0.5">
        <Link
          to="/show/$showId"
          params={{ showId: String(show.id) }}
          search={{ from: "/watch-order" }}
          className="block truncate font-medium text-foreground hover:text-primary"
        >
          {show.title}
        </Link>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {show.year ? <span>{show.year}</span> : null}
          {genres ? <span className="truncate">{genres}</span> : null}
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="shrink-0 text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive"
        onClick={() => onDelete(show)}
      >
        Remove
      </Button>
    </div>
  );
}

export function WatchOrderPage() {
  const queryClient = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<ApiShow | null>(null);
  const [localOrder, setLocalOrder] = useState<number[] | null>(null);

  const { imageBase } = useSession();

  const showsQuery = useQuery({
    queryKey: queryKeys.showList(WATCH_ORDER_PARAMS.toString()),
    queryFn: ({ signal }) => api.listShows(WATCH_ORDER_PARAMS, { signal }),
    placeholderData: keepPreviousData,
  });

  const reorderMutation = useMutation({
    mutationFn: (orderedIds: number[]) => api.reorderShows(orderedIds),
    onSuccess: async () => {
      // Keep showing the local order until the server order has arrived, or
      // the list would snap back to the old order for a moment.
      await queryClient.invalidateQueries({ queryKey: queryKeys.shows });
      setLocalOrder(null);
      toast.success("Order saved.");
    },
    onError: () => {
      toast.error("Failed to save order.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.removeFromWatchOrder(id),
    onSuccess: (data, id) => {
      setPendingDelete(null);
      // Keep any unsaved reorder of the remaining shows.
      setLocalOrder((prev) => prev?.filter((localId) => localId !== id) ?? null);
      queryClient.setQueryData(queryKeys.show(id), data);
      void queryClient.invalidateQueries({ queryKey: queryKeys.shows });
      toast.success("Removed from watch order.");
    },
    onError: () => {
      toast.error("Failed to remove from watch order.");
    },
  });

  const serverShows = useMemo(() => showsQuery.data?.shows ?? [], [showsQuery.data?.shows]);

  // Display order: use local drag state if present, otherwise server order
  const displayShows = useMemo(() => {
    if (!localOrder) return serverShows;
    const byId = new Map(serverShows.map((s) => [s.id, s]));
    return localOrder.flatMap((id) => {
      const show = byId.get(id);
      return show ? [show] : [];
    });
  }, [serverShows, localOrder]);

  const serverIds = useMemo(() => serverShows.map((s) => s.id), [serverShows]);
  const isDirty =
    localOrder !== null &&
    (localOrder.length !== serverIds.length || localOrder.some((id, i) => serverIds[i] !== id));
  const { isInitialLoading, isEmpty, isError } = listState(showsQuery, serverShows.length);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentIds = displayShows.map((s) => s.id);
    const oldIndex = currentIds.indexOf(active.id as number);
    const newIndex = currentIds.indexOf(over.id as number);
    setLocalOrder(arrayMove(currentIds, oldIndex, newIndex));
  };

  const handleMoveToPosition = (show: ApiShow, newIndex: number) => {
    const currentIds = displayShows.map((s) => s.id);
    const oldIndex = currentIds.indexOf(show.id);
    if (oldIndex === newIndex) return;
    setLocalOrder(arrayMove(currentIds, oldIndex, newIndex));
  };

  const handleSave = () => {
    const ids = displayShows.map((s) => s.id);
    reorderMutation.mutate(ids);
  };

  return (
    <PullToRefresh onRefresh={() => queryClient.invalidateQueries({ queryKey: queryKeys.shows })}>
      <section className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="font-display text-xl sm:text-2xl">Watch order</h1>
            <p className="text-sm text-muted-foreground">
              Drag to reorder. Add shows from the detail page.
            </p>
          </div>
          {isDirty ? (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setLocalOrder(null)}
                disabled={reorderMutation.isPending}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={reorderMutation.isPending}>
                Save order
              </Button>
            </div>
          ) : null}
        </div>

        {isInitialLoading ? <LoadingGrid /> : null}

        {isError ? (
          <Empty className="border-border/60 bg-card/30">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CircleAlert />
              </EmptyMedia>
              <EmptyTitle>Could not load the watch order</EmptyTitle>
              <EmptyDescription>Pull down or reload the page to try again.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {isEmpty ? (
          <Empty className="border-border/60 bg-card/30">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Film />
              </EmptyMedia>
              <EmptyTitle>Watch order is empty</EmptyTitle>
              <EmptyDescription>Add shows via the detail page.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {displayShows.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-border/60 shadow-lg">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={displayShows.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                {displayShows.map((show, index) => (
                  <SortableRow
                    key={show.id}
                    show={show}
                    index={index}
                    total={displayShows.length}
                    imageBase={imageBase}
                    onDelete={setPendingDelete}
                    onMoveToPosition={handleMoveToPosition}
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
              <AlertDialogTitle>Remove from watch order?</AlertDialogTitle>
              <AlertDialogDescription>
                "{pendingDelete?.title}" will be removed from the watch order but kept in your
                library.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
                }}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </PullToRefresh>
  );
}
