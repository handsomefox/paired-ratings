import { useSyncExternalStore } from "react";
import { changelog } from "./changelog";

// The version of the changelog this browser has shown. It is per device, not
// per person: the two people share one login.
const STORAGE_KEY = "changelog-seen";

/**
 * The newest entry's date and how many changes it lists, so a change added
 * later on the same day counts as new too.
 */
function currentVersion(): string {
  const newest = changelog[0];
  if (!newest) return "";
  return `${newest.date}:${(newest.highlights?.length ?? 0) + newest.changes.length}`;
}

const listeners = new Set<() => void>();

function readSeen(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    // Storage can be off, for example in a private window. Then nothing is
    // marked as new.
    return currentVersion();
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

/** Whether the changelog has changed since this browser last showed it. */
export function useHasUnseenChanges(): boolean {
  const seen = useSyncExternalStore(subscribe, readSeen);
  return seen !== currentVersion();
}

/** Records that every entry has been shown. */
export function markChangesSeen() {
  const version = currentVersion();
  if (!version || readSeen() === version) return;
  try {
    localStorage.setItem(STORAGE_KEY, version);
  } catch {
    return;
  }
  for (const listener of listeners) listener();
}
