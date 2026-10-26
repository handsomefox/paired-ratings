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
};

/**
 * The filters in a sticky side pane on large screens and in a sheet behind a
 * "Filters" button on small ones, next to the page content.
 */
export function FiltersPane({ filters, children, headerAction }: FiltersPaneProps) {
  // The sheet is a Radix dialog, which already locks page scroll and closes on
  // Escape, so this component adds neither.
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <section className="space-y-7">
      <div className="flex flex-wrap items-end justify-end gap-4">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="lg:hidden">
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex h-[100svh] w-[100vw] flex-col overflow-hidden bg-card text-foreground sm:w-[320px]"
          >
            <SheetHeader>
              <div className="flex items-center justify-between gap-2">
                <SheetTitle>Filters</SheetTitle>
                {headerAction}
              </div>
              <SheetDescription className="sr-only">
                Adjust filter options and close the panel when finished.
              </SheetDescription>
            </SheetHeader>
            <div
              className="mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-20"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {filters}
            </div>

            <div className="absolute inset-x-0 bottom-2 border-t bg-card p-4">
              <div className="mx-6 px-4">
                <Button className="w-full" onClick={() => setSheetOpen(false)}>
                  Done
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-5 xl:grid-cols-[300px_minmax(0,1fr)] xl:gap-6">
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

        <div className="w-full min-w-0">
          <div className="mx-auto w-full space-y-4 px-4 sm:px-6">{children}</div>
        </div>
      </div>
    </section>
  );
}
