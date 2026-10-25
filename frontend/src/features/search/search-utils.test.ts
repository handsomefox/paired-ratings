import {
  buildSearchParams,
  parseGenres,
  sanitizeMediaType,
  sanitizeSort,
} from "@/features/search/search-utils";
import { describe, expect, it } from "vitest";

describe("parseGenres", () => {
  it("reads a comma list as match-all", () => {
    expect(parseGenres("18,35")).toEqual({ mode: "all", selected: ["18", "35"] });
  });

  it("reads a pipe list as match-any", () => {
    expect(parseGenres("18|35")).toEqual({ mode: "any", selected: ["18", "35"] });
  });

  it("ignores blanks and a missing value", () => {
    expect(parseGenres(" 18, ,35 ")).toEqual({ mode: "all", selected: ["18", "35"] });
    expect(parseGenres(undefined)).toEqual({ mode: "all", selected: [] });
  });
});

describe("sanitizeSort", () => {
  it("keeps a known sort", () => {
    expect(sanitizeSort("rating")).toBe("rating");
    expect(sanitizeSort(" Votes ")).toBe("votes");
  });

  it("falls back to relevance for anything else", () => {
    expect(sanitizeSort("price")).toBe("relevance");
    expect(sanitizeSort(undefined)).toBe("relevance");
  });
});

describe("sanitizeMediaType", () => {
  it("defaults to movie", () => {
    expect(sanitizeMediaType("tv")).toBe("tv");
    expect(sanitizeMediaType("books")).toBe("movie");
  });
});

describe("buildSearchParams", () => {
  const base = {
    mediaType: "movie" as const,
    trimmedQuery: "",
    yearFrom: "",
    yearTo: "",
    minRating: "",
    minVotes: "",
    sort: "relevance" as const,
    genres: "",
    originCountry: "",
    originalLanguage: "",
    page: 1,
  };

  it("leaves out defaults", () => {
    expect(buildSearchParams(base).toString()).toBe("media_type=movie");
  });

  it("includes every set filter and pages past the first", () => {
    const params = buildSearchParams({
      ...base,
      trimmedQuery: "dune",
      yearFrom: "2000",
      sort: "rating",
      genres: "18|35",
      page: 3,
    });
    expect(Object.fromEntries(params)).toEqual({
      media_type: "movie",
      q: "dune",
      year_from: "2000",
      sort: "rating",
      genres: "18|35",
      page: "3",
    });
  });
});
