import { cleanPage, pageNumber, parseSearch, stringifySearch } from "@/lib/search-params";
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
    expect(decoded).toMatchObject({ genre: "Action & Adventure", q: "star wars" });
  });

  it("reads an href built with URLSearchParams the same way", () => {
    const href = new URLSearchParams(search).toString();
    expect(parseSearch(`?${href}`)).toMatchObject({ genre: "Action & Adventure", q: "star wars" });
  });
});

describe("cleanPage", () => {
  it("keeps a page past the first, decoded as a number or not", () => {
    expect(cleanPage("3")).toBe("3");
    expect(cleanPage(3)).toBe("3");
  });

  it("drops page 1 and anything that is not a positive whole number", () => {
    for (const junk of [1, "1", 0, "0", "-2", "2.5", "two", true, undefined]) {
      expect(cleanPage(junk)).toBeUndefined();
    }
  });

  it("reads a missing page as page 1", () => {
    expect(pageNumber(undefined)).toBe(1);
    expect(pageNumber("4")).toBe(4);
  });
});
