import { ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";

import { cn, scrollToTop } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// How far down the page the button appears, in pixels.
const THRESHOLD = 320;

export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let ticking = false;

    const update = () => {
      const scrollTop = window.scrollY;
      const doc = document.documentElement;
      const isAtBottom = scrollTop + window.innerHeight >= doc.scrollHeight - 8;
      setVisible(scrollTop > THRESHOLD && !isAtBottom);
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
        "fixed bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] right-4 z-40 h-12 w-12 rounded-full border-border/60 bg-card/80 shadow-lg backdrop-blur transition-all sm:right-6 sm:h-11 sm:w-11",
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <ArrowUp className="h-4 w-4" />
    </Button>
  );
}
