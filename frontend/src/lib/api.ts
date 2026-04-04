import type * as pb from "../gen/paired_ratings";

export type SessionResponse = pb.SessionResponse;
export type ApiShow = pb.Show;
export type ApiShowDetail = pb.ShowDetail;
export type ListResponse = pb.ListResponse;
export type SearchResult = pb.SearchResult;
export type SearchRequest = pb.SearchRequest;
export type SearchResponse = pb.SearchResponse;
export type SearchGenresResponse = pb.SearchGenresResponse;
export type SearchCountriesResponse = pb.SearchCountriesResponse;
export type SearchLanguagesResponse = pb.SearchLanguagesResponse;
export type SearchResolveResponse = pb.SearchResolveResponse;
export type LoginRequest = pb.LoginRequest;
export type AddShowRequest = pb.AddShowRequest;
export type RatingsRequest = pb.RatingsRequest;
export type RefreshResponse = pb.RefreshResponse;
export type ExportPayload = pb.ExportPayload;
export type ReorderRequest = pb.ReorderRequest;
export type SetStatusRequest = pb.SetStatusRequest;
export type GetRelatedResponse = pb.GetRelatedResponse;
export type EpisodesResponse = pb.EpisodesResponse;
export type ApiEpisode = pb.Episode;
export type ToggleEpisodeRequest = pb.ToggleEpisodeRequest;

let _onUnauthorized: (() => void) | undefined;
export const registerUnauthorizedHandler = (fn: () => void) => {
  _onUnauthorized = fn;
};

async function jsonRequest<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });
  if (!res.ok) {
    if (res.status === 401) {
      _onUnauthorized?.();
    }
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const api = {
  session: ({ signal }: { signal?: AbortSignal } = {}) =>
    jsonRequest<SessionResponse>("/api/session", { signal }),
  login: (payload: LoginRequest) =>
    jsonRequest<SessionResponse>("/api/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logout: () =>
    jsonRequest<SessionResponse>("/api/logout", {
      method: "POST",
    }),
  listShows: (params: URLSearchParams) =>
    jsonRequest<ListResponse>(`/api/shows?${params.toString()}`),
  getShow: (id: number) => jsonRequest<ApiShowDetail>(`/api/shows/${id}`),
  addShow: (payload: AddShowRequest) =>
    jsonRequest<ApiShowDetail>("/api/shows", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteShow: (id: number) =>
    jsonRequest<void>(`/api/shows/${id}`, {
      method: "DELETE",
    }),
  updateRatings: (id: number, payload: RatingsRequest) =>
    jsonRequest<ApiShowDetail>(`/api/shows/${id}/ratings`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  reorderShows: (orderedIds: number[]) =>
    jsonRequest<void>("/api/shows/reorder", {
      method: "POST",
      body: JSON.stringify({ ordered_ids: orderedIds } satisfies ReorderRequest),
    }),
  setStatus: (id: number, status: string) =>
    jsonRequest<ApiShowDetail>(`/api/shows/${id}/set-status`, {
      method: "POST",
      body: JSON.stringify({ status } satisfies SetStatusRequest),
    }),
  clearRatings: (id: number) =>
    jsonRequest<ApiShowDetail>(`/api/shows/${id}/clear-ratings`, {
      method: "POST",
    }),
  refreshShow: (id: number) =>
    jsonRequest<ApiShowDetail>(`/api/shows/${id}/refresh-tmdb`, {
      method: "POST",
    }),
  getRelated: (id: number) => jsonRequest<GetRelatedResponse>(`/api/shows/${id}/related`),
  getEpisodes: (id: number) => jsonRequest<EpisodesResponse>(`/api/shows/${id}/episodes`),
  syncEpisodes: (id: number) =>
    jsonRequest<EpisodesResponse>(`/api/shows/${id}/episodes/sync`, {
      method: "POST",
    }),
  toggleEpisode: (episodeId: number, watched: boolean) =>
    jsonRequest<void>(`/api/shows/episodes/${episodeId}/toggle`, {
      method: "POST",
      body: JSON.stringify({ watched } satisfies ToggleEpisodeRequest),
    }),
  toggleSeason: (showId: number, seasonNumber: number, watched: boolean) =>
    jsonRequest<void>(`/api/shows/${showId}/episodes/season/${seasonNumber}/toggle`, {
      method: "POST",
      body: JSON.stringify({ watched } satisfies ToggleEpisodeRequest),
    }),
  addToWatchOrder: (id: number) =>
    jsonRequest<ApiShowDetail>(`/api/shows/${id}/watch-order`, {
      method: "POST",
    }),
  removeFromWatchOrder: (id: number) =>
    jsonRequest<ApiShowDetail>(`/api/shows/${id}/watch-order`, {
      method: "DELETE",
    }),
  search: (params: URLSearchParams) =>
    jsonRequest<SearchResponse>(`/api/search?${params.toString()}`),
  searchGenres: () => jsonRequest<SearchGenresResponse>("/api/search/genres"),
  searchCountries: () => jsonRequest<SearchCountriesResponse>("/api/search/countries"),
  searchLanguages: () => jsonRequest<SearchLanguagesResponse>("/api/search/languages"),
  searchResolve: (tmdbId: number, mediaType: string) =>
    jsonRequest<SearchResolveResponse>(
      `/api/search/resolve?tmdb_id=${tmdbId}&media_type=${mediaType}`,
    ),
  refreshTMDB: () =>
    jsonRequest<RefreshResponse>("/api/refresh-tmdb", {
      method: "POST",
    }),
  exportData: () =>
    fetch("/api/export", {
      method: "POST",
      credentials: "include",
    }),
  exportDB: () =>
    fetch("/api/export/db", {
      credentials: "include",
    }),
};
