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
import { cn } from "@/lib/utils";
import { useState, type FormEvent } from "react";

export type SearchPaginationProps = {
  totalPages: number;
  activePage: number;
  isCompact: boolean;
  pageItems: Array<number | "ellipsis">;
  onGoToPage: (page: number) => void;
};

export function SearchPagination({
  totalPages,
  activePage,
  isCompact,
  pageItems,
  onGoToPage,
}: SearchPaginationProps) {
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState("");

  if (totalPages <= 1) return null;

  const handleJumpSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!jumpValue.trim()) return;
    const parsed = Number(jumpValue);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.max(1, Math.min(totalPages || 1, Math.floor(parsed)));
    setJumpOpen(false);
    onGoToPage(clamped);
  };

  return (
    <Pagination className="pt-6">
      {isCompact ? (
        <PaginationContent className="w-full justify-between px-2">
          <PaginationItem>
            <PaginationPrevious
              href="#"
              size="icon"
              className={cn("pl-0 pr-0", activePage <= 1 ? "pointer-events-none opacity-50" : "")}
              onClick={(event) => {
                event.preventDefault();
                onGoToPage(activePage - 1);
              }}
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
                  className="rounded-md border border-border/60 bg-card/40 px-3 py-2 text-sm tabular-nums"
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
                    <label className="text-sm font-medium text-foreground" htmlFor="jump-page">
                      Page number (1-{totalPages})
                    </label>
                    <Input
                      id="jump-page"
                      name="jump-page"
                      type="number"
                      min={1}
                      max={totalPages}
                      inputMode="numeric"
                      autoFocus
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
              className={cn(
                "pl-0 pr-0",
                activePage >= totalPages ? "pointer-events-none opacity-50" : "",
              )}
              onClick={(event) => {
                event.preventDefault();
                onGoToPage(activePage + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      ) : (
        <PaginationContent className="flex-wrap justify-center">
          <PaginationItem>
            <PaginationPrevious
              href="#"
              className={activePage <= 1 ? "pointer-events-none opacity-50" : ""}
              onClick={(event) => {
                event.preventDefault();
                onGoToPage(activePage - 1);
              }}
            />
          </PaginationItem>

          {pageItems.map((item, index) => (
            <PaginationItem key={`${item}-${index}`}>
              {item === "ellipsis" ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  href="#"
                  isActive={item === activePage}
                  onClick={(event) => {
                    event.preventDefault();
                    onGoToPage(item);
                  }}
                >
                  {item}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext
              href="#"
              className={activePage >= totalPages ? "pointer-events-none opacity-50" : ""}
              onClick={(event) => {
                event.preventDefault();
                onGoToPage(activePage + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      )}
    </Pagination>
  );
}
