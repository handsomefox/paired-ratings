import { api, registerUnauthorizedHandler } from "@/lib/api";
import { beforeEach, describe, expect, it, vi } from "vitest";

type FetchMock = ReturnType<typeof vi.fn>;

function mockFetch(response: Partial<Response> & { json?: () => unknown }): FetchMock {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(""),
    ...response,
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function requestBody(fetchMock: FetchMock): unknown {
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  return JSON.parse(init.body as string);
}

describe("api", () => {
  beforeEach(() => {
    registerUnauthorizedHandler(() => {});
  });

  it("posts the password to the login endpoint", async () => {
    const fetchMock = mockFetch({ json: () => Promise.resolve({ authenticated: true }) });

    await expect(api.login({ password: "hunter2" })).resolves.toEqual({ authenticated: true });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/login");
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(requestBody(fetchMock)).toEqual({ password: "hunter2" });
  });

  it("sends both ratings and both comments in one request", async () => {
    const fetchMock = mockFetch({});

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
    const episodeFetch = mockFetch({ status: 204 });
    await api.toggleEpisode(42, true);
    expect(episodeFetch.mock.calls[0][0]).toBe("/api/shows/episodes/42/toggle");
    expect(requestBody(episodeFetch)).toEqual({ watched: true });

    const seasonFetch = mockFetch({ status: 204 });
    await api.toggleSeason(3, 2, false);
    expect(seasonFetch.mock.calls[0][0]).toBe("/api/shows/3/episodes/season/2/toggle");
    expect(requestBody(seasonFetch)).toEqual({ watched: false });
  });

  it("sends the watch order as ordered_ids", async () => {
    const fetchMock = mockFetch({ status: 204 });

    await api.reorderShows([5, 3, 9]);

    expect(fetchMock.mock.calls[0][0]).toBe("/api/shows/reorder");
    expect(requestBody(fetchMock)).toEqual({ ordered_ids: [5, 3, 9] });
  });

  it("returns undefined for a 204 instead of parsing an empty body", async () => {
    mockFetch({
      status: 204,
      json: () => Promise.reject(new Error("must not parse a 204 body")),
    });

    await expect(api.toggleEpisode(1, true)).resolves.toBeUndefined();
  });

  it("throws the response body and notifies the handler on 401", async () => {
    const onUnauthorized = vi.fn();
    registerUnauthorizedHandler(onUnauthorized);
    mockFetch({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: () => Promise.resolve("session expired"),
    });

    await expect(api.getShow(1)).rejects.toThrow("session expired");
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("falls back to the status text when the error body is empty", async () => {
    const onUnauthorized = vi.fn();
    registerUnauthorizedHandler(onUnauthorized);
    mockFetch({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: () => Promise.resolve(""),
    });

    await expect(api.getShow(1)).rejects.toThrow("Internal Server Error");
    expect(onUnauthorized).not.toHaveBeenCalled();
  });
});
