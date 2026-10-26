import { useCallback, useSyncExternalStore } from "react";

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );
  // Read during render, so the first paint already has the right layout
  // instead of switching after an effect.
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches);
}
