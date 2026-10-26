import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type FiltersPaneProps = {
  filters: ReactNode;
  children: ReactNode;
  // Rendered beside the title in both the desktop pane and the mobile sheet,
  // so an action that applies to the whole pane reads as belonging to it.
  headerAction?: ReactNode;
  /** The number of filters set, shown on the button that opens the sheet. */
  activeCount: number;
  /** The top row of the page content. On small screens it ends with the button that opens the sheet. */
  toolbar: ReactNode;
};

/**
 * The filters in a sticky side pane on large screens and in a sheet behind a
 * "Filters" button on small ones, next to the page content.
 */
export function FiltersPane({
  filters,
  children,
  headerAction,
  activeCount,
  toolbar,
}: FiltersPaneProps) {
  // The sheet is a Radix dialog, which already locks page scroll and closes on
  // Escape, so this component adds neither.
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <section className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[300px_minmax(0,1fr)] xl:gap-8">
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100svh-6rem)] overflow-y-auto rounded-2xl border border-border/60 bg-card/80 p-5 pr-4 shadow-lg lg:p-6 lg:pr-5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Filters
            </div>
            {headerAction}
          </div>
          <div className="mt-5">{filters}</div>
        </div>
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">{toolbar}</div>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="shrink-0 lg:hidden">
                <SlidersHorizontal />
                Filters
                {activeCount > 0 ? (
                  <span className="min-w-5 rounded-full bg-primary px-1.5 text-xs leading-5 text-primary-foreground">
                    {activeCount}
                  </span>
                ) : null}
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex h-[100svh] w-[100vw] flex-col gap-0 bg-card p-0 pt-[env(safe-area-inset-top)] text-foreground sm:w-[340px]"
            >
              {/* The right padding keeps the header clear of the close button. */}
              <SheetHeader className="px-5 pb-5 pr-14 pt-4 text-left">
                <div className="flex min-h-8 items-center justify-between gap-2">
                  <SheetTitle>Filters</SheetTitle>
                  {headerAction}
                </div>
                <SheetDescription className="sr-only">
                  Adjust filter options and close the panel when finished.
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
                {filters}
              </div>
              <div className="border-t border-border/60 px-5 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
                <Button className="h-11 w-full" onClick={() => setSheetOpen(false)}>
                  Done
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        {children}
      </div>
    </section>
  );
}
