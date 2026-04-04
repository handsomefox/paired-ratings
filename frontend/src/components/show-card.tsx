import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";

type ShowCardProps = {
  title: ReactNode;
  year?: ReactNode;
  posterPath?: string | null;
  posterAlt: string;
  imageBase: string;
  posterLink?: (node: ReactNode) => ReactNode;
  topRight?: ReactNode;
  statusBadge?: ReactNode;
  metaBadges?: ReactNode;
  metaBadgesClassName?: string;
  genresText?: string | null;
  episodeMeta?: ReactNode;
  overview?: string | null;
  footer?: ReactNode;
  overviewExpanded?: boolean;
  onToggleOverview?: () => void;
  className?: string;
};

export function ShowCard({
  title,
  year,
  posterPath,
  posterAlt,
  imageBase,
  posterLink,
  topRight,
  statusBadge,
  metaBadges,
  metaBadgesClassName,
  genresText,
  episodeMeta,
  overview,
  footer,
  overviewExpanded,
  onToggleOverview,
  className,
}: ShowCardProps) {
  const [internalExpanded, setInternalExpanded] = useState(false);
  const [canToggle, setCanToggle] = useState(false);
  const overviewRef = useRef<HTMLParagraphElement | null>(null);
  const isExpanded = overviewExpanded ?? internalExpanded;
  const handleToggle =
    onToggleOverview ??
    (() => {
      setInternalExpanded((prev) => !prev);
    });

  useLayoutEffect(() => {
    const node = overviewRef.current;
    if (!node) return;

    const update = () => {
      if (!node) return;
      setCanToggle(node.scrollHeight > node.clientHeight + 1);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [overview, isExpanded]);

  const poster = (
    <div className="h-[320px] overflow-hidden bg-muted/40 sm:aspect-[2/3] sm:h-auto">
      {posterPath ? (
        <img
          src={`${imageBase}${posterPath}`}
          alt={posterAlt}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-xs uppercase tracking-wide text-muted-foreground">
          No poster
        </div>
      )}
    </div>
  );

  return (
    <Card
      className={cn(
        "group flex flex-col overflow-hidden border-border/60 bg-card/70 shadow-lg",
        className,
      )}
    >
      <div className="relative">
        {posterLink ? posterLink(poster) : poster}
        {topRight ? <div className="absolute right-0 top-0">{topRight}</div> : null}
        {statusBadge ? (
          <div className="absolute left-0 top-0">{statusBadge}</div>
        ) : null}
      </div>
      <CardContent className="flex flex-1 flex-col gap-2.5 p-3 sm:gap-3 sm:p-4 lg:gap-4 lg:p-5">
        <div className="space-y-2">
          <div>
            <div className="text-base font-semibold leading-tight sm:text-lg">{title}</div>
            {year ? <div className="text-xs text-muted-foreground sm:text-sm">{year}</div> : null}
          </div>

          {genresText ? (
            <div className="text-xs text-muted-foreground sm:text-sm">{genresText}</div>
          ) : null}

          {episodeMeta ?? null}

          {overview ? (
            <div className="space-y-1">
              <p
                ref={overviewRef}
                className={`text-xs text-muted-foreground sm:text-sm ${
                  isExpanded ? "" : "line-clamp-3 min-h-[3.6em]"
                }`}
              >
                {overview}
              </p>
              {canToggle ? (
                <button
                  type="button"
                  className="cursor-pointer text-xs font-semibold text-primary/80 underline underline-offset-2 transition hover:text-primary"
                  onClick={handleToggle}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? "Show less" : "Show more"}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {metaBadges || footer ? (
          <div className="mt-auto space-y-2">
            {metaBadges ? (
              <div
                className={cn("grid w-full gap-2 text-xs", metaBadgesClassName ?? "grid-cols-2")}
              >
                {metaBadges}
              </div>
            ) : null}
            {footer ? <div>{footer}</div> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
