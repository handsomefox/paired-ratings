import * as pb from "@/gen/paired_ratings";
import { pageSearch, renderApp } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const search = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: {
    session: () => Promise.resolve(pb.SessionResponse.fromJSON({ authenticated: true })),
    searchCountries: () => Promise.resolve(pb.SearchCountriesResponse.fromJSON({})),
    searchLanguages: () => Promise.resolve(pb.SearchLanguagesResponse.fromJSON({})),
    searchGenres: () =>
      Promise.resolve(
        pb.SearchGenresResponse.fromJSON({
          movie_genres: [
            { id: 18, name: "Drama" },
            { id: 35, name: "Comedy" },
          ],
        }),
      ),
    search: (params: URLSearchParams) => search(params.toString()),
  },
}));

function results(titles: string[], page = 1, totalPages = 1) {
  return pb.SearchResponse.fromJSON({
    results: titles.map((title, i) => ({ id: i + 1, media_type: "movie", title })),
    page,
    total_pages: totalPages,
    total_results: titles.length,
  });
}

const never = () => new Promise(() => {});

describe("SearchPage", () => {
  beforeEach(() => {
    search.mockResolvedValue(results(["Dune"]));
  });

  it("names each add button after its title", async () => {
    renderApp("/search?q=dune");

    expect(await screen.findByRole("button", { name: "Plan Dune" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Watched Dune" })).toBeInTheDocument();
  });

  // keepPreviousData keeps the old answer, page number included, on screen
  // while the next one loads. That number must not leak into the new URL.
  it("starts a new query at page 1 while its results load", async () => {
    search.mockResolvedValueOnce(results(["Dune"], 3, 5)).mockImplementation(never);
    const user = userEvent.setup();
    const { router } = renderApp("/search?q=dune&page=3");
    await screen.findByText("Dune");

    await user.type(screen.getByRole("searchbox", { name: "Search TMDB" }), "s");

    await waitFor(() => expect(pageSearch(router)).toEqual({ q: "dunes" }));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(pageSearch(router)).toEqual({ q: "dunes" });
  });

  it("does not report no results for a query that is still loading", async () => {
    search.mockResolvedValueOnce(results([])).mockImplementation(never);
    const user = userEvent.setup();
    renderApp("/search?q=zzz");
    expect(await screen.findByText("No results found")).toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search TMDB" }), "z");

    await waitFor(() => expect(search).toHaveBeenLastCalledWith("media_type=movie&q=zzzz"));
    expect(screen.queryByText("No results found")).not.toBeInTheDocument();
  });

  it("shows an error rather than an empty result when TMDB fails", async () => {
    search.mockRejectedValue(new Error("offline"));
    renderApp("/search?q=dune");

    expect(await screen.findByText("Could not search TMDB")).toBeInTheDocument();
    expect(screen.queryByText("No results found")).not.toBeInTheDocument();
  });

  it("turns the genre names from Find similar into ids before it searches", async () => {
    const { router } = renderApp("/search?genre_names=Drama,Comedy");

    await waitFor(() => expect(pageSearch(router)).toEqual({ genres: "18,35" }));
    await waitFor(() => expect(search).toHaveBeenCalled());
    expect(search.mock.calls.map(([params]) => params)).toEqual([
      "media_type=movie&genres=18%2C35",
    ]);
  });
});
