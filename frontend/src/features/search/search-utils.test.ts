import {
  cleanRating,
  cleanVotes,
  parseGenres,
  sanitizeMediaType,
  sanitizeSort,
  searchApiParams,
  validateSearchPageSearch,
} from "@/features/search/search-utils";
import { parseSearch } from "@/lib/search-params";
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

describe("cleanRating and cleanVotes", () => {
  it("keep a usable minimum", () => {
    expect(cleanRating(" 7.5 ")).toBe("7.5");
    expect(cleanVotes("0100")).toBe("100");
  });

  it("drop anything TMDB cannot filter by", () => {
    expect(cleanRating("11")).toBe("");
    expect(cleanRating("-1")).toBe("");
    expect(cleanVotes("2.5")).toBe("");
    expect(cleanVotes("")).toBe("");
  });
});

describe("validateSearchPageSearch", () => {
  const fromUrl = (query: string) => validateSearchPageSearch(parseSearch(query));

  it("keeps a full set of filters", () => {
    expect(
      fromUrl(
        "?q=dune&media_type=tv&year_from=2000&min_rating=7&min_votes=50&sort=rating&genres=18|35&origin_country=gb&original_language=EN&page=2",
      ),
    ).toEqual({
      q: "dune",
      media_type: "tv",
      year_from: "2000",
      min_rating: "7",
      min_votes: "50",
      sort: "rating",
      genres: "18|35",
      origin_country: "GB",
      original_language: "en",
      page: "2",
    });
  });

  it("drops defaults and junk from an old link", () => {
    expect(
      fromUrl("?media_type=movie&sort=relevance&page=1&year_from=20&min_rating=x&sort=price"),
    ).toEqual({});
  });

  it("keeps a query that the decoder would turn into a number or a boolean", () => {
    expect(fromUrl("?q=1917").q).toBe("1917");
    expect(fromUrl("?q=true").q).toBe("true");
  });
});

describe("searchApiParams", () => {
  it("always names the media type and leaves out the genre names", () => {
    expect(searchApiParams({ genre_names: "Drama" }).toString()).toBe("media_type=movie");
  });

  it("sends every set filter", () => {
    expect(
      Object.fromEntries(
        searchApiParams({ q: "dune", media_type: "tv", genres: "18|35", page: "3" }),
      ),
    ).toEqual({ media_type: "tv", q: "dune", genres: "18|35", page: "3" });
  });
});
