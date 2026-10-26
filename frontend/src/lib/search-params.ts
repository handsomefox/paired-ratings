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

/** A page number above 1 as a string, or undefined for page 1 and junk. */
export function cleanPage(value: unknown): string | undefined {
  const raw = parseSearchString(value);
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const page = Number(raw);
  return page > 1 ? String(page) : undefined;
}

/** The page number a cleaned `page` param stands for. */
export function pageNumber(page: string | undefined): number {
  return page ? Number(page) : 1;
}
