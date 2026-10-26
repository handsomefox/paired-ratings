import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

import { cn, scrollToTop } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// How far down the page the button appears, in pixels.
const THRESHOLD = 320;
// How far the page must move, in pixels, to count as a change of direction.
const DIRECTION_SLACK = 8;

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;
    let lastScrollTop = window.scrollY;
    let scrollingUp = false;

    // The button only shows while scrolling up, so it does not sit over the
    // controls at the right edge while the reader works down a page.
    const update = () => {
      const scrollTop = window.scrollY;
      if (Math.abs(scrollTop - lastScrollTop) > DIRECTION_SLACK) {
        scrollingUp = scrollTop < lastScrollTop;
        lastScrollTop = scrollTop;
      }
      const doc = document.documentElement;
      const isAtBottom = scrollTop + window.innerHeight >= doc.scrollHeight - 8;
      setVisible(scrollTop > THRESHOLD && scrollingUp && !isAtBottom);
      ticking = false;
    };

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={scrollToTop}
      // Hidden by opacity only, so take it out of the tab order and the
      // accessibility tree while it is not shown.
      inert={!visible}
      aria-label="Scroll to top"
      className={cn(
        "fixed bottom-[calc(var(--bottom-inset)+1rem)] right-4 z-40 h-11 w-11 rounded-full border-border/60 bg-card/80 shadow-lg backdrop-blur transition-all sm:right-6 md:bottom-[calc(var(--bottom-inset)+1.5rem)]",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <ArrowUp className="h-4 w-4" />
    </Button>
  );
}
