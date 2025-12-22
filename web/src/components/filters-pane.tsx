import * as React from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
    <section className="space-y-6">
      <div className={cn("flex items-center justify-end gap-2", headerClassName)}>
        <Sheet open={filtersOpen} onOpenChange={onOpenChange}>
          <SheetTrigger asChild>
            <Button variant="outline" className="lg:hidden">
              {triggerLabel}
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex h-[100svh] w-[320px] flex-col overflow-hidden bg-card text-foreground"
          >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div
            className="mt-6 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-3 lg:pr-2"
            style={{ WebkitOverflowScrolling: "touch" }}
            ref={scrollRef}
          >
            {filters}
          </div>
        </SheetContent>
      </Sheet>
    </div>

      <div className={cn("grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]", gridClassName)}>
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100svh-6rem)] overflow-y-auto rounded-2xl border border-border/60 bg-card/70 p-5 pr-4 shadow-lg">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {title}
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
