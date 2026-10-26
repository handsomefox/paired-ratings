import { useEffect } from "react";

/**
 * Sets --keyboard-inset on the root element to the height the on-screen
 * keyboard covers, so a bottom-anchored dialog can sit above it.
 */
export function useKeyboardInset(enabled = true) {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!enabled || !viewport) return;

    const updateInset = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--keyboard-inset", `${inset}px`);
    };

    updateInset();
    viewport.addEventListener("resize", updateInset);
    viewport.addEventListener("scroll", updateInset);

    return () => {
      viewport.removeEventListener("resize", updateInset);
      viewport.removeEventListener("scroll", updateInset);
      document.documentElement.style.removeProperty("--keyboard-inset");
    };
  }, [enabled]);
}
