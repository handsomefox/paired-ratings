import { api, ApiError, registerUnauthorizedHandler } from "@/lib/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

type FetchMock = ReturnType<typeof vi.fn>;

function jsonResponse(body: unknown, init: { status?: number; statusText?: string } = {}) {
  const status = init.status ?? 200;
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    statusText: init.statusText,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function mockFetch(response: Response): FetchMock {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestInit(fetchMock: FetchMock): RequestInit {
  return fetchMock.mock.calls[0][1] as RequestInit;
}

function requestBody(fetchMock: FetchMock): unknown {
  return JSON.parse(requestInit(fetchMock).body as string);
}

describe("api", () => {
  beforeEach(() => {
    registerUnauthorizedHandler(() => {});
  });

  it("posts the password to the login endpoint", async () => {
    const fetchMock = mockFetch(jsonResponse({ authenticated: true }));

    await expect(api.login({ password: "hunter2" })).resolves.toEqual({ authenticated: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/login");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });
    expect(requestBody(fetchMock)).toEqual({ password: "hunter2" });
  });

  it("sends no JSON content type on a request without a body", async () => {
    const fetchMock = mockFetch(jsonResponse({ shows: [] }));

    await api.listShows(new URLSearchParams({ page_size: "all" }));

    expect(fetchMock.mock.calls[0][0]).toBe("/api/shows?page_size=all");
    expect(requestInit(fetchMock).method).toBe("GET");
    expect(requestInit(fetchMock).headers).toBeUndefined();
  });

  it("sends both ratings and both comments in one request", async () => {
    const fetchMock = mockFetch(jsonResponse({}));

    await api.updateRatings(7, {
      bf_rating: 9,
      gf_rating: 4,
      bf_comment: "great",
      gf_comment: "fine",
    });

    expect(fetchMock.mock.calls[0][0]).toBe("/api/shows/7/ratings");
    expect(requestBody(fetchMock)).toEqual({
      bf_rating: 9,
      gf_rating: 4,
      bf_comment: "great",
      gf_comment: "fine",
    });
  });

  it("toggles one episode and a whole season on different endpoints", async () => {
    const episodeFetch = mockFetch(jsonResponse(null, { status: 204 }));
    await api.toggleEpisode(42, true);
    expect(episodeFetch.mock.calls[0][0]).toBe("/api/shows/episodes/42/toggle");
    expect(requestBody(episodeFetch)).toEqual({ watched: true });

    const seasonFetch = mockFetch(jsonResponse(null, { status: 204 }));
    await api.toggleSeason(3, 2, false);
    expect(seasonFetch.mock.calls[0][0]).toBe("/api/shows/3/episodes/season/2/toggle");
    expect(requestBody(seasonFetch)).toEqual({ watched: false });
  });

  it("sends the watch order as ordered_ids", async () => {
    const fetchMock = mockFetch(jsonResponse(null, { status: 204 }));

    await api.reorderShows([5, 3, 9]);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/shows/reorder");
    expect(requestBody(fetchMock)).toEqual({ ordered_ids: [5, 3, 9] });
  });

  it("returns undefined for a 204 instead of parsing an empty body", async () => {
    mockFetch(jsonResponse(null, { status: 204 }));

    await expect(api.toggleEpisode(1, true)).resolves.toBeUndefined();
  });

  // encoding/json leaves out false, 0, "" and empty lists. The generated
  // decoder must put them back so the types hold.
  it("fills in the zero values the backend leaves out", async () => {
    mockFetch(
      jsonResponse({
        episodes: [{ id: 1, season_number: 1, episode_number: 1 }],
        total_seasons: 1,
      }),
    );

    const response = await api.getEpisodes(5);

    expect(response.episodes[0].watched).toBe(false);
  });

  it("decodes a show with genres as a list and no origin countries", async () => {
    mockFetch(jsonResponse({ show: { id: 3, title: "Dark", genres: ["Drama", "Mystery"] } }));

    const detail = await api.getShow(3);

    expect(detail.show?.genres).toEqual(["Drama", "Mystery"]);
    expect(detail.show?.origin_country).toEqual([]);
    expect(detail.show?.status).toBe("");
  });

  it("throws an ApiError with the ErrorResponse message and the status", async () => {
    mockFetch(jsonResponse({ error: "not found" }, { status: 404, statusText: "Not Found" }));

    const error = await api.getShow(1).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: "not found" });
  });

  it("notifies the handler when the session has expired", async () => {
    const onUnauthorized = vi.fn();
    registerUnauthorizedHandler(onUnauthorized);
    mockFetch(jsonResponse({ error: "unauthorized" }, { status: 401 }));

    await expect(api.getShow(1)).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("does not treat a wrong password as an expired session", async () => {
    const onUnauthorized = vi.fn();
    registerUnauthorizedHandler(onUnauthorized);
    mockFetch(jsonResponse({ error: "invalid password" }, { status: 401 }));

    await expect(api.login({ password: "wrong" })).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("falls back to the status text when the error body is not JSON", async () => {
    const onUnauthorized = vi.fn();
    registerUnauthorizedHandler(onUnauthorized);
    mockFetch(new Response("", { status: 502, statusText: "Bad Gateway" }));

    await expect(api.getShow(1)).rejects.toMatchObject({ status: 502, message: "Bad Gateway" });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
