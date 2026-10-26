import { libraryApiParams, validateLibrarySearch } from "@/features/library/library-search";
import { parseSearch } from "@/lib/search-params";
import { describe, expect, it } from "vitest";

// What the router hands validateSearch for a query string.
const fromUrl = (query: string) => validateLibrarySearch(parseSearch(query));

describe("validateLibrarySearch", () => {
  it("keeps every valid filter", () => {
    expect(
      fromUrl(
        "?status=watched&genre=Drama&origin_country=de&year_from=2010&year_to=2020&unrated=1&sort=title&page=3&page_size=50",
      ),
    ).toEqual({
      status: "watched",
      genre: "Drama",
      origin_country: "DE",
      year_from: "2010",
      year_to: "2020",
      unrated: "1",
      sort: "title",
      page: "3",
      page_size: "50",
    });
  });

  // GET /api/shows answers 400 for each of these, so an old link would
  // otherwise show an error instead of the library.
  it("falls back to the defaults for values the backend rejects", () => {
    expect(
      fromUrl("?status=dropped&sort=rating&page=0&page_size=7&year_from=20&unrated=yes"),
    ).toEqual({});
  });

  it("leaves out values that are the defaults", () => {
    expect(fromUrl("?sort=created&page=1&page_size=20")).toEqual({});
  });

  it("never sends the watch-order sort from the library", () => {
    expect(fromUrl("?sort=priority").sort).toBeUndefined();
  });
});

describe("libraryApiParams", () => {
  it("sends only the filters that are set", () => {
    expect(libraryApiParams({ status: "planned", page: "2" }).toString()).toBe(
      "status=planned&page=2",
    );
  });
});
