package tmdb

import (
	"strconv"
	"strings"
)

type SearchResult struct {
	MediaType        string
	Title            string
	Year             string
	PosterPath       string
	Overview         string
	ID               int64
	VoteAverage      float64
	VoteCount        int
	Popularity       float64
	GenreIDs         []int
	OriginCountry    []string
	OriginalLanguage string
}

type SearchPage struct {
	Results      []SearchResult
	Page         int
	TotalPages   int
	TotalResults int
}

type Detail struct {
	MediaType       string
	Title           string
	Year            string
	Overview        string
	PosterPath      string
	IMDbID          string
	Genres          []string
	OriginCountry   []string
	TMDBID          int64
	VoteAverage     float64
	VoteCount       int
	CollectionID    int64
	CollectionName  string
	NumberOfSeasons int
}

type DiscoverFilters struct {
	YearFrom         *int
	YearTo           *int
	MinRating        *float64
	MinVotes         *int
	Genres           string
	Sort             string
	OriginCountry    string
	OriginalLanguage string
}

type Genre struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type Country struct {
	Code string
	Name string
}

type Language struct {
	Code string
	Name string
}

type searchResponse struct {
	Results []struct {
		Title            string   `json:"title"`
		Name             string   `json:"name"`
		ReleaseDate      string   `json:"release_date"`
		FirstAirDate     string   `json:"first_air_date"`
		PosterPath       string   `json:"poster_path"`
		Overview         string   `json:"overview"`
		ID               int64    `json:"id"`
		VoteAverage      float64  `json:"vote_average"`
		VoteCount        int      `json:"vote_count"`
		Popularity       float64  `json:"popularity"`
		GenreIDs         []int    `json:"genre_ids"`
		OriginCountry    []string `json:"origin_country"`
		OriginalLanguage string   `json:"original_language"`
	} `json:"results"`
	Page         int `json:"page"`
	TotalPages   int `json:"total_pages"`
	TotalResults int `json:"total_results"`
}

type detailResponse struct {
	Title               string   `json:"title"`
	Name                string   `json:"name"`
	ReleaseDate         string   `json:"release_date"`
	FirstAirDate        string   `json:"first_air_date"`
	PosterPath          string   `json:"poster_path"`
	Overview            string   `json:"overview"`
	OriginCountry       []string `json:"origin_country"`
	ProductionCountries []struct {
		ISO3166 string `json:"iso_3166_1"`
	} `json:"production_countries"`
	ExternalIDs struct {
		IMDbID string `json:"imdb_id"`
	} `json:"external_ids"`
	Genres []struct {
		Name string `json:"name"`
	} `json:"genres"`
	BelongsToCollection struct {
		ID   int64  `json:"id"`
		Name string `json:"name"`
	} `json:"belongs_to_collection"`
	NumberOfSeasons int     `json:"number_of_seasons"`
	ID              int64   `json:"id"`
	VoteAverage     float64 `json:"vote_average"`
	VoteCount       int     `json:"vote_count"`
}

type collectionResponse struct {
	Parts []struct {
		ID          int64   `json:"id"`
		Title       string  `json:"title"`
		ReleaseDate string  `json:"release_date"`
		PosterPath  string  `json:"poster_path"`
		Overview    string  `json:"overview"`
		VoteAverage float64 `json:"vote_average"`
		VoteCount   int     `json:"vote_count"`
		Popularity  float64 `json:"popularity"`
	} `json:"parts"`
}

type recommendationsResponse struct {
	Results []struct {
		ID               int64    `json:"id"`
		MediaType        string   `json:"media_type"`
		Name             string   `json:"name"`
		Title            string   `json:"title"`
		FirstAirDate     string   `json:"first_air_date"`
		ReleaseDate      string   `json:"release_date"`
		PosterPath       string   `json:"poster_path"`
		Overview         string   `json:"overview"`
		VoteAverage      float64  `json:"vote_average"`
		VoteCount        int      `json:"vote_count"`
		Popularity       float64  `json:"popularity"`
		GenreIDs         []int    `json:"genre_ids"`
		OriginalLanguage string   `json:"original_language"`
		OriginCountry    []string `json:"origin_country"`
	} `json:"results"`
}

type genreResponse struct {
	Genres []Genre `json:"genres"`
}

type countryResponse []struct {
	ISO3166     string `json:"iso_3166_1"`
	EnglishName string `json:"english_name"`
}

type languageResponse []struct {
	ISO639      string `json:"iso_639_1"`
	EnglishName string `json:"english_name"`
	Name        string `json:"name"`
}

type Season struct {
	Episodes []Episode
}

type Episode struct {
	SeasonNumber  int
	EpisodeNumber int
	Title         string
	AirDate       string
	Runtime       int
}

type seasonResponse struct {
	SeasonNumber int `json:"season_number"`
	Episodes     []struct {
		EpisodeNumber int    `json:"episode_number"`
		Name          string `json:"name"`
		AirDate       string `json:"air_date"`
		Runtime       int    `json:"runtime"`
	} `json:"episodes"`
}

func ParseYear(year string) *int {
	year = strings.TrimSpace(year)
	if year == "" {
		return nil
	}
	val, err := strconv.Atoi(year)
	if err != nil {
		return nil
	}
	return &val
}
