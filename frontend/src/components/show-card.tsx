import { Card, CardContent } from "@/components/ui/card";
import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";

type ShowCardProps = {
  title: ReactNode;
  year?: ReactNode;
  posterPath?: string | null;
  posterAlt: string;
  imageBase: string;
  posterLink?: (node: ReactNode) => ReactNode;
  statusBadge?: ReactNode;
  metaBadges?: ReactNode;
  genresText?: string | null;
  episodeMeta?: ReactNode;
  overview?: string | null;
  footer?: ReactNode;
};

export function ShowCard({
  title,
  year,
  posterPath,
  posterAlt,
  imageBase,
  posterLink,
  statusBadge,
  metaBadges,
  genresText,
  episodeMeta,
  overview,
  footer,
}: ShowCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [canToggle, setCanToggle] = useState(false);
  const overviewRef = useRef<HTMLParagraphElement | null>(null);

  useLayoutEffect(() => {
    const node = overviewRef.current;
    if (!node) return;

    // Expanding drops the line clamp, so scrollHeight and clientHeight become
    // equal. Measuring then would decide the text fits and unmount the button
    // that collapses it again, stranding the reader in the expanded state.
    const update = () => {
      if (isExpanded) return;
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
    <Card className="group flex flex-col overflow-hidden border-border/60 bg-card/70 shadow-lg">
      <div className="relative">
        {posterLink ? posterLink(poster) : poster}
        {statusBadge ? <div className="absolute left-0 top-0">{statusBadge}</div> : null}
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

          {episodeMeta}

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
                  onClick={() => setIsExpanded((prev) => !prev)}
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
              <div className="grid w-full grid-cols-2 gap-2 text-xs">{metaBadges}</div>
            ) : null}
            {footer ? <div>{footer}</div> : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
