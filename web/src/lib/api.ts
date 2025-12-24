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
  toggleStatus: (id: number) =>
    jsonRequest<ApiShowDetail>(`/api/shows/${id}/toggle-status`, {
      method: "POST",
    }),
  clearRatings: (id: number) =>
    jsonRequest<ApiShowDetail>(`/api/shows/${id}/clear-ratings`, {
      method: "POST",
    }),
  refreshShow: (id: number) =>
    jsonRequest<ApiShowDetail>(`/api/shows/${id}/refresh-tmdb`, {
      method: "POST",
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
};
