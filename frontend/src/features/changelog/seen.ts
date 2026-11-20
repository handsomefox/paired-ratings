import { useSyncExternalStore } from "react";
import { changelog } from "./changelog";

// The date of the newest entry this browser has shown. It is per device, not
// per person: the two people share one login.
const STORAGE_KEY = "changelog-seen";

const listeners = new Set<() => void>();

function readSeen(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    // Storage can be off, for example in a private window. Then nothing is
    // marked as new.
    return changelog[0]?.date ?? "";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** Whether the changelog has an entry newer than the last one shown here. */
export function useHasUnseenChanges(): boolean {
  const seen = useSyncExternalStore(subscribe, readSeen);
  const newest = changelog[0]?.date ?? "";
  // The dates are YYYY-MM-DD, which compare in time order as text.
  return newest > seen;
}

/** Records that every entry has been shown. */
export function markChangesSeen() {
  const newest = changelog[0]?.date;
  if (!newest || readSeen() >= newest) return;
  try {
    localStorage.setItem(STORAGE_KEY, newest);
  } catch {
    return;
  }
  for (const listener of listeners) listener();
}
