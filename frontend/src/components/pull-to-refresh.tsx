import { useEffect, useRef, useState } from "react";

const THRESHOLD = 80; // px pull distance to trigger refresh
const MAX_PULL = 120; // px max visual pull distance

type PullToRefreshProps = {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
};

export function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      // Only activate when at the top of the page
      if (window.scrollY > 0) return;
      startYRef.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null || refreshing) return;
      if (window.scrollY > 0) {
        startYRef.current = null;
        setPullDistance(0);
        return;
      }
      const delta = e.touches[0].clientY - startYRef.current;
      if (delta <= 0) {
        setPullDistance(0);
        return;
      }
      // Rubber-band resistance
      const distance = Math.min(delta * 0.5, MAX_PULL);
      setPullDistance(distance);
      if (distance > 0) e.preventDefault();
    };

    const onTouchEnd = async () => {
      if (startYRef.current === null) return;
      startYRef.current = null;

      if (pullDistance >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        setPullDistance(0);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      } else {
        setPullDistance(0);
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [pullDistance, refreshing, onRefresh]);

  const indicatorVisible = pullDistance > 0 || refreshing;
  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div ref={containerRef} className="relative">
      {indicatorVisible ? (
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 z-50 flex justify-center transition-transform"
          style={{ transform: `translateY(${refreshing ? 48 : pullDistance - 16}px)` }}
        >
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card shadow-md ${
              refreshing ? "animate-spin" : ""
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-muted-foreground"
              style={{
                opacity: refreshing ? 1 : progress,
                transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
              }}
            >
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                d="M12 4V2m0 0a8 8 0 1 0 8 8"
              />
            </svg>
          </div>
        </div>
      ) : null}
      <div
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: pullDistance === 0 ? "transform 0.2s ease" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
