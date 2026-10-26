import * as pb from "@/gen/paired_ratings";
import { pageSearch, renderApp } from "@/test/render";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listShows = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  api: {
    session: () =>
      Promise.resolve(pb.SessionResponse.fromJSON({ authenticated: true, bf_name: "Alex" })),
    searchCountries: () => Promise.resolve(pb.SearchCountriesResponse.fromJSON({})),
    listShows: (params: URLSearchParams) => listShows(params.toString()),
    getShow: (id: number) =>
      Promise.resolve(
        pb.ShowDetail.fromJSON({ show: { id, title: `Show ${id}`, media_type: "movie" } }),
      ),
    getRelated: () => Promise.resolve(pb.GetRelatedResponse.fromJSON({})),
  },
}));

function listResponse(count: number, total = count) {
  return pb.ListResponse.fromJSON({
    shows: Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title: `Show ${i + 1}`,
      status: "planned",
    })),
    total_count: total,
  });
}

describe("LibraryPage", () => {
  beforeEach(() => {
    listShows.mockResolvedValue(listResponse(2));
  });

  it("reads the filters from the URL and follows it when a link clears them", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/?status=watched&sort=title");

    await waitFor(() => expect(listShows).toHaveBeenCalledWith("status=watched&sort=title"));

    // The navbar link has no search, so it lands on the bare library.
    await user.click(screen.getByRole("link", { name: "Library" }));

    await waitFor(() => expect(listShows).toHaveBeenLastCalledWith(""));
    expect(pageSearch(router)).toEqual({});
  });

  // Replacing the entry would give it a new key, and the router would no
  // longer find the scroll position it saved under the old one.
  it("leaves the history entry alone when it opens", async () => {
    const { router } = renderApp("/?status=planned");
    const key = router.state.location.state.__TSR_key;

    expect(await screen.findByText("Show 1")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(router.state.location.state.__TSR_key).toBe(key);
  });

  it("writes a typed year to the URL after a pause, and Reset clears the text", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/?page=2");
    await screen.findByText("Show 1");

    const yearFrom = screen.getByLabelText("Year from");
    await user.type(yearFrom, "2015");

    // A filter change also starts again at page 1.
    await waitFor(() => expect(pageSearch(router)).toEqual({ year_from: "2015" }));
    expect(listShows).toHaveBeenLastCalledWith("year_from=2015");

    await user.click(screen.getByRole("button", { name: "Reset (1)" }));

    await waitFor(() => expect(yearFrom).toHaveValue(null));
    expect(pageSearch(router)).toEqual({});
  });

  // Going back in history, rather than pushing the library again, returns to
  // the entry whose scroll position the router saved.
  it("returns to the same history entry from a show's Back button", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/?status=planned");
    await screen.findByText("Show 1");
    const key = router.state.location.state.__TSR_key;

    await user.click(screen.getByRole("link", { name: "Show 1" }));
    await user.click(await screen.findByRole("button", { name: /Back to library/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(router.state.location.state.__TSR_key).toBe(key);
    expect(pageSearch(router)).toEqual({ status: "planned" });
  });

  it("opens the library from a show page that was not reached by a link", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/show/1?from=%2F%3Fstatus%3Dwatched");

    await user.click(await screen.findByRole("button", { name: /Back to library/ }));

    await waitFor(() => expect(pageSearch(router)).toEqual({ status: "watched" }));
  });

  it("moves to the last page when the page is past the end", async () => {
    listShows.mockResolvedValue(listResponse(0, 30));
    const { router } = renderApp("/?page=5");

    await waitFor(() => expect(pageSearch(router)).toEqual({ page: "2" }));
  });

  it("ignores junk from an old link instead of sending it to the backend", async () => {
    renderApp("/?sort=rating&page=0&page_size=7");

    await waitFor(() => expect(listShows).toHaveBeenCalledWith(""));
  });
});
