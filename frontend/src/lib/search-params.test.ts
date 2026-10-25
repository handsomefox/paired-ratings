import { parseSearch, pickSearch, stringifySearch } from "@/lib/search-params";
import { describe, expect, it } from "vitest";

describe("search params", () => {
  const search = {
    year_from: "2015",
    genre: "Action & Adventure",
    q: "star wars",
    unrated: "1",
  };

  it("writes plain values without JSON quotes", () => {
    const encoded = stringifySearch(search);
    expect(encoded).toContain("year_from=2015");
    expect(encoded).not.toContain("%22");
  });

  it("reads back what it wrote, spaces and ampersands included", () => {
    const decoded = parseSearch(stringifySearch(search));
    expect(pickSearch(decoded, ["year_from", "genre", "q", "unrated"] as const)).toEqual(search);
  });

  it("reads an href built with URLSearchParams the same way", () => {
    const href = new URLSearchParams(search).toString();
    expect(pickSearch(parseSearch(`?${href}`), ["year_from", "genre", "q"] as const)).toEqual({
      year_from: "2015",
      genre: "Action & Adventure",
      q: "star wars",
    });
  });

  it("keeps a query that the decoder would turn into a boolean", () => {
    expect(pickSearch(parseSearch("?q=true"), ["q"] as const)).toEqual({ q: "true" });
  });

  it("drops empty and unknown keys", () => {
    expect(pickSearch(parseSearch("?q=&other=1"), ["q"] as const)).toEqual({});
  });
});
