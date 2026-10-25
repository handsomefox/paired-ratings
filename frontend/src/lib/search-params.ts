import { parseSearchWith, stringifySearchWith } from "@tanstack/react-router";

// Every search value in this app is a plain string. The router's default
// serializer JSON-encodes strings that look like numbers, which would turn
// year_from=2015 into year_from=%222015%22. These keep values as they are.
export const parseSearch = parseSearchWith((value) => value);
export const stringifySearch = stringifySearchWith(JSON.stringify);

// The router's query decoder still turns "2015" into a number and "true" into
// a boolean, so both are turned back into strings here.
export function parseSearchString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return String(value);
  return undefined;
}

/** Keeps the listed keys that hold a non-empty value, as strings. */
export function pickSearch<K extends string>(
  search: Record<string, unknown>,
  keys: readonly K[],
): Partial<Record<K, string>> {
  const next: Partial<Record<K, string>> = {};
  for (const key of keys) {
    const value = parseSearchString(search[key]);
    if (value) next[key] = value;
  }
  return next;
}
