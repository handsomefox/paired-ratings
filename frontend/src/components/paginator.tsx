import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getPageItems } from "@/lib/pagination";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import { useId, useState, type FormEvent, type MouseEvent } from "react";

export type PaginatorProps = {
  totalPages: number;
  activePage: number;
  onGoToPage: (page: number) => void;
  className?: string;
};

// Props for a prev/next link that cannot be followed. pointer-events-none
// alone still leaves it focusable and announced as a working link.
function disabledLinkProps(disabled: boolean) {
  return disabled
    ? { "aria-disabled": true, tabIndex: -1, className: "pointer-events-none opacity-50" }
    : {};
}

export function Paginator({ totalPages, activePage, onGoToPage, className }: PaginatorProps) {
  const isCompact = useMediaQuery("(max-width: 640px)");
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState("");
  const jumpInputId = useId();

  if (totalPages <= 1) return null;

  const pageItems = getPageItems(totalPages, activePage, isCompact ? 1 : 2, 1);
  const atStart = activePage <= 1;
  const atEnd = activePage >= totalPages;

  const go = (page: number) => (event: MouseEvent) => {
    event.preventDefault();
    onGoToPage(Math.max(1, Math.min(totalPages, page)));
  };

  const handleJumpSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!jumpValue.trim()) return;
    const parsed = Number(jumpValue);
    if (!Number.isFinite(parsed)) return;
    setJumpOpen(false);
    onGoToPage(Math.max(1, Math.min(totalPages, Math.floor(parsed))));
  };

  const previous = disabledLinkProps(atStart);
  const next = disabledLinkProps(atEnd);

  return (
    <Pagination className={cn("pt-6", className)}>
      {isCompact ? (
        <PaginationContent className="w-full justify-between px-2">
          <PaginationItem>
            <PaginationPrevious
              href="#"
              size="icon"
              {...previous}
              className={cn("pl-0 pr-0", previous.className)}
              onClick={go(activePage - 1)}
            />
          </PaginationItem>

          <PaginationItem>
            <Dialog
              open={jumpOpen}
              onOpenChange={(open) => {
                setJumpOpen(open);
                if (open) {
                  setJumpValue(String(activePage));
                }
              }}
            >
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="cursor-pointer rounded-md border border-border/60 bg-card/40 px-3 py-2 text-sm tabular-nums"
                  aria-label={`Page ${activePage} of ${totalPages}. Jump to page`}
                >
                  {activePage} / {totalPages}
                </button>
              </DialogTrigger>
              <DialogContent className="bottom-[calc(env(safe-area-inset-bottom)+var(--keyboard-inset,0px)+1rem)] top-auto w-[90vw] max-w-xs translate-y-0 sm:bottom-auto sm:top-1/2 sm:translate-y-[-50%]">
                <DialogHeader>
                  <DialogTitle>Jump to page</DialogTitle>
                  <DialogDescription className="sr-only">
                    Enter a page number to move to that result page.
                  </DialogDescription>
                </DialogHeader>
                <form className="space-y-4" onSubmit={handleJumpSubmit}>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground" htmlFor={jumpInputId}>
                      Page number (1-{totalPages})
                    </label>
                    {/* The dialog moves focus to this input when it opens. */}
                    <Input
                      id={jumpInputId}
                      name="jump-page"
                      type="number"
                      min={1}
                      max={totalPages}
                      inputMode="numeric"
                      value={jumpValue}
                      onChange={(event) => setJumpValue(event.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit">Go</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </PaginationItem>

          <PaginationItem>
            <PaginationNext
              href="#"
              size="icon"
              {...next}
              className={cn("pl-0 pr-0", next.className)}
              onClick={go(activePage + 1)}
            />
          </PaginationItem>
        </PaginationContent>
      ) : (
        <PaginationContent className="flex-wrap justify-center">
          <PaginationItem>
            <PaginationPrevious href="#" {...previous} onClick={go(activePage - 1)} />
          </PaginationItem>

          {pageItems.map((item, index) => (
            <PaginationItem key={`${item}-${index}`}>
              {item === "ellipsis" ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  href="#"
                  isActive={item === activePage}
                  aria-label={`Page ${item}`}
                  onClick={go(item)}
                >
                  {item}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext href="#" {...next} onClick={go(activePage + 1)} />
          </PaginationItem>
        </PaginationContent>
      )}
    </Pagination>
  );
}
