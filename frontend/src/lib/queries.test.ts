import { ApiError, type SearchResponse } from "@/lib/api";
import { onShowAdded, onShowDeleted, queryKeys, shouldRetry } from "@/lib/queries";
import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

const page = (libraryId?: number): SearchResponse => ({
  results: [
    {
      id: 10,
      media_type: "movie",
      title: "Arrival",
      year: "2016",
      poster_path: "",
      overview: "",
      vote_average: 7.6,
      vote_count: 100,
      library_id: libraryId,
      genres: [],
      original_language: "en",
    },
  ],
  page: 1,
  total_pages: 1,
  total_results: 1,
});

describe("shouldRetry", () => {
  it("retries a server or network failure once", () => {
    expect(shouldRetry(0, new ApiError(500, "internal server error"))).toBe(true);
    expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
  });

  it("does not retry an answer that will not change", () => {
    expect(shouldRetry(0, new ApiError(404, "not found"))).toBe(false);
    expect(shouldRetry(0, new ApiError(401, "unauthorized"))).toBe(false);
  });
});

describe("library cache updates", () => {
  it("marks the added title in every cached search page", () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.search("q=arrival"), page());
    client.setQueryData(queryKeys.search("q=arrival&page=2"), page());

    onShowAdded(client, { tmdbId: 10, mediaType: "movie", libraryId: 77 });

    expect(
      client.getQueryData<SearchResponse>(queryKeys.search("q=arrival"))?.results[0],
    ).toMatchObject({ library_id: 77 });
    expect(
      client.getQueryData<SearchResponse>(queryKeys.search("q=arrival&page=2"))?.results[0],
    ).toMatchObject({ library_id: 77 });
  });

  it("does not mark a TV show that shares the movie's TMDB id", () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.search("q=arrival"), page());

    onShowAdded(client, { tmdbId: 10, mediaType: "tv", libraryId: 77 });

    expect(
      client.getQueryData<SearchResponse>(queryKeys.search("q=arrival"))?.results[0].library_id,
    ).toBeUndefined();
  });

  it("clears the library link and the detail cache after a delete", () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.related(3), page(77));
    client.setQueryData(queryKeys.show(77), { show: undefined });

    onShowDeleted(client, 77);

    expect(
      client.getQueryData<SearchResponse>(queryKeys.related(3))?.results[0].library_id,
    ).toBeUndefined();
    expect(client.getQueryData(queryKeys.show(77))).toBeUndefined();
  });
});
