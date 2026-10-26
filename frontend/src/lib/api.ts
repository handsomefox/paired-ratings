import * as pb from "../gen/paired_ratings";

export type ApiShow = pb.Show;
export type ApiShowDetail = pb.ShowDetail;
export type SearchResult = pb.SearchResult;
export type SearchResponse = pb.SearchResponse;
export type GetRelatedResponse = pb.GetRelatedResponse;
export type EpisodesResponse = pb.EpisodesResponse;
export type ApiEpisode = pb.Episode;
export type ApiGenre = pb.Genre;
export type ApiCountry = pb.Country;
export type ApiLanguage = pb.Language;

/** A non-2xx response. `message` is the backend's ErrorResponse text. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let onUnauthorized: (() => void) | undefined;
export const registerUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

type RequestOptions = {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  // A 401 from the login endpoint means a wrong password, not an expired
  // session, so it must not trigger the sign-out handler.
  notifyUnauthorized?: boolean;
};

async function errorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const message = pb.ErrorResponse.fromJSON(JSON.parse(text)).error;
    if (message) return message;
  } catch {
    // Not JSON, for example a proxy error page. Fall through.
  }
  return text.trim() || res.statusText || `HTTP ${res.status}`;
}

async function request(input: string, options: RequestOptions = {}): Promise<Response> {
  const { method = "GET", body, signal, notifyUnauthorized = true } = options;
  const res = await fetch(input, {
    method,
    signal,
    credentials: "include",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    if (res.status === 401 && notifyUnauthorized) {
      onUnauthorized?.();
    }
    throw new ApiError(res.status, await errorMessage(res));
  }
  return res;
}

async function jsonRequest<T>(
  decoder: pb.MessageFns<T>,
  input: string,
  options?: RequestOptions,
): Promise<T> {
  const res = await request(input, options);
  return decoder.fromJSON(await res.json());
}

async function emptyRequest(input: string, options?: RequestOptions): Promise<void> {
  await request(input, options);
}

type Signal = { signal?: AbortSignal };

export const api = {
  session: ({ signal }: Signal = {}) => jsonRequest(pb.SessionResponse, "/api/session", { signal }),
  login: (payload: pb.LoginRequest) =>
    jsonRequest(pb.SessionResponse, "/api/login", {
      method: "POST",
      body: payload,
      notifyUnauthorized: false,
    }),
  logout: () => jsonRequest(pb.SessionResponse, "/api/logout", { method: "POST" }),
  listShows: (params: URLSearchParams, { signal }: Signal = {}) =>
    jsonRequest(pb.ListResponse, `/api/shows?${params.toString()}`, { signal }),
  getShow: (id: number, { signal }: Signal = {}) =>
    jsonRequest(pb.ShowDetail, `/api/shows/${id}`, { signal }),
  addShow: (payload: pb.AddShowRequest) =>
    jsonRequest(pb.ShowDetail, "/api/shows", { method: "POST", body: payload }),
  deleteShow: (id: number) => emptyRequest(`/api/shows/${id}`, { method: "DELETE" }),
  updateRatings: (id: number, payload: pb.RatingsRequest) =>
    jsonRequest(pb.ShowDetail, `/api/shows/${id}/ratings`, { method: "POST", body: payload }),
  reorderShows: (orderedIds: number[]) =>
    emptyRequest("/api/shows/reorder", {
      method: "POST",
      body: { ordered_ids: orderedIds } satisfies pb.ReorderRequest,
    }),
  setStatus: (id: number, status: string) =>
    jsonRequest(pb.ShowDetail, `/api/shows/${id}/set-status`, {
      method: "POST",
      body: { status } satisfies pb.SetStatusRequest,
    }),
  clearRatings: (id: number) =>
    jsonRequest(pb.ShowDetail, `/api/shows/${id}/clear-ratings`, { method: "POST" }),
  refreshShow: (id: number) =>
    jsonRequest(pb.ShowDetail, `/api/shows/${id}/refresh-tmdb`, { method: "POST" }),
  getRelated: (id: number, { signal }: Signal = {}) =>
    jsonRequest(pb.GetRelatedResponse, `/api/shows/${id}/related`, { signal }),
  getEpisodes: (id: number, { signal }: Signal = {}) =>
    jsonRequest(pb.EpisodesResponse, `/api/shows/${id}/episodes`, { signal }),
  syncEpisodes: (id: number) =>
    jsonRequest(pb.EpisodesResponse, `/api/shows/${id}/episodes/sync`, { method: "POST" }),
  toggleEpisode: (episodeId: number, watched: boolean) =>
    emptyRequest(`/api/shows/episodes/${episodeId}/toggle`, {
      method: "POST",
      body: { watched } satisfies pb.ToggleEpisodeRequest,
    }),
  toggleSeason: (showId: number, seasonNumber: number, watched: boolean) =>
    emptyRequest(`/api/shows/${showId}/episodes/season/${seasonNumber}/toggle`, {
      method: "POST",
      body: { watched } satisfies pb.ToggleEpisodeRequest,
    }),
  addToWatchOrder: (id: number) =>
    jsonRequest(pb.ShowDetail, `/api/shows/${id}/watch-order`, { method: "POST" }),
  removeFromWatchOrder: (id: number) =>
    jsonRequest(pb.ShowDetail, `/api/shows/${id}/watch-order`, { method: "DELETE" }),
  search: (params: URLSearchParams, { signal }: Signal = {}) =>
    jsonRequest(pb.SearchResponse, `/api/search?${params.toString()}`, { signal }),
  searchGenres: ({ signal }: Signal = {}) =>
    jsonRequest(pb.SearchGenresResponse, "/api/search/genres", { signal }),
  searchCountries: ({ signal }: Signal = {}) =>
    jsonRequest(pb.SearchCountriesResponse, "/api/search/countries", { signal }),
  searchLanguages: ({ signal }: Signal = {}) =>
    jsonRequest(pb.SearchLanguagesResponse, "/api/search/languages", { signal }),
  searchResolve: (tmdbId: number, mediaType: string) =>
    jsonRequest(
      pb.SearchResolveResponse,
      `/api/search/resolve?${new URLSearchParams({ tmdb_id: String(tmdbId), media_type: mediaType })}`,
    ),
  refreshTMDB: () => jsonRequest(pb.RefreshResponse, "/api/refresh-tmdb", { method: "POST" }),
  // The exports are file downloads, so the caller reads the body as a blob.
  exportData: () => request("/api/export", { method: "POST" }),
  exportDB: () => request("/api/export/db"),
};
