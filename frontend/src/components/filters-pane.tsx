import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type FiltersPaneProps = {
  filtersOpen: boolean;
  onOpenChange: (open: boolean) => void;
  filters: React.ReactNode;
  children: React.ReactNode;
  headerClassName?: string;
  gridClassName?: string;
  title?: string;
  triggerLabel?: string;
  // Rendered beside the title in both the desktop pane and the mobile sheet,
  // so an action that applies to the whole pane reads as belonging to it.
  headerAction?: React.ReactNode;
};

const FiltersPane = ({
  filtersOpen,
  onOpenChange,
  filters,
  children,
  headerClassName,
  gridClassName,
  title = "Filters",
  triggerLabel = "Filters",
  headerAction,
}: FiltersPaneProps) => {
  const bodyStyleRef = React.useRef<{
    overflow: string;
    position: string;
    top: string;
    width: string;
    overscrollBehavior: string;
    scrollY: number;
  } | null>(null);
  const htmlStyleRef = React.useRef<{
    overflow: string;
    overscrollBehavior: string;
  } | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!filtersOpen || typeof document === "undefined") return;

    const { body, documentElement } = document;
    const scrollY = window.scrollY || document.documentElement.scrollTop;

    if (!bodyStyleRef.current) {
      bodyStyleRef.current = {
        overflow: body.style.overflow,
        position: body.style.position,
        top: body.style.top,
        width: body.style.width,
        overscrollBehavior: body.style.overscrollBehavior,
        scrollY,
      };
    }
    if (!htmlStyleRef.current) {
      htmlStyleRef.current = {
        overflow: documentElement.style.overflow,
        overscrollBehavior: documentElement.style.overscrollBehavior,
      };
    }

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overscrollBehavior = "contain";
    documentElement.style.overflow = "hidden";
    documentElement.style.overscrollBehavior = "contain";

    return () => {
      if (bodyStyleRef.current) {
        const { overflow, position, top, width, overscrollBehavior, scrollY } =
          bodyStyleRef.current;
        body.style.overflow = overflow;
        body.style.position = position;
        body.style.top = top;
        body.style.width = width;
        body.style.overscrollBehavior = overscrollBehavior;
        window.scrollTo(0, scrollY);
      }
      bodyStyleRef.current = null;
      if (htmlStyleRef.current) {
        documentElement.style.overflow = htmlStyleRef.current.overflow;
        documentElement.style.overscrollBehavior = htmlStyleRef.current.overscrollBehavior;
      }
      htmlStyleRef.current = null;
    };
  }, [filtersOpen]);

  return (
    <section className="space-y-7">
      <div className={cn("flex items-center justify-end gap-2", headerClassName)}>
        <Sheet open={filtersOpen} onOpenChange={onOpenChange}>
          <SheetTrigger asChild>
            <Button variant="outline" className="lg:hidden">
              {triggerLabel}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex h-[100svh] w-[100vw] flex-col overflow-hidden bg-card text-foreground sm:w-[320px]"
          >
            <SheetHeader>
              <div className="flex items-center justify-between gap-2">
                <SheetTitle>{title}</SheetTitle>
                {headerAction}
              </div>
              <SheetDescription className="sr-only">
                Adjust filter options and close the panel when finished.
              </SheetDescription>
            </SheetHeader>
            <div
              ref={scrollRef}
              className="mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-20"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {filters}
            </div>

            <div className="absolute inset-x-0 bottom-2 border-t bg-card p-4 lg:hidden">
              <div className="mx-6 px-4">
                <Button className="w-full" onClick={() => onOpenChange(false)}>
                  Done
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div
        className={cn(
          "grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-5 xl:grid-cols-[300px_minmax(0,1fr)] xl:gap-6",
          gridClassName,
        )}
      >
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100svh-6rem)] overflow-y-auto rounded-2xl border border-border/60 bg-card/80 p-5 pr-4 shadow-lg lg:p-6 lg:pr-5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
              </div>
              {headerAction}
            </div>
            <div className="mt-5">{filters}</div>
          </div>
        </aside>

        {children}
      </div>
    </section>
  );
};

export default FiltersPane;
