export const sortOptions = [
  { value: "relevance", label: "Relevance" },
  { value: "rating", label: "TMDB rating" },
  { value: "votes", label: "TMDB votes" },
  { value: "year", label: "Year" },
  { value: "title", label: "Title" },
] as const;

export const mediaTypeOptions = [
  { value: "movie", label: "Movie" },
  { value: "tv", label: "TV" },
] as const;

export type MediaType = (typeof mediaTypeOptions)[number]["value"];
export type Sort = (typeof sortOptions)[number]["value"];
