package handlers

import (
	"fmt"
	"math"
	"strings"

	"github.com/handsomefox/paired-ratings/backend/gen/pb"
	"github.com/handsomefox/paired-ratings/backend/store"
	"github.com/handsomefox/paired-ratings/backend/tmdb"
)

// clampInt32 keeps counts and external metadata within the API's integer range.
func clampInt32[T int | int64](value T) int32 {
	return int32(min(max(int64(value), math.MinInt32), math.MaxInt32))
}

// optional returns nil for an empty or blank string.
func optional(s string) *string {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	return &s
}

// positive returns nil for zero, which TMDB uses for "unknown".
func positive[T int | int64 | float64](v T) *T {
	if v <= 0 {
		return nil
	}
	return &v
}

func imdbURL(imdbID *string) *string {
	if imdbID == nil {
		return nil
	}
	return optional("https://www.imdb.com/title/" + *imdbID + "/")
}

func tmdbURL(mediaType string, tmdbID int64) string {
	return fmt.Sprintf("https://www.themoviedb.org/%s/%d", mediaType, tmdbID)
}

func metadataFromDetail(d *tmdb.Detail) *store.Metadata {
	var year *int64
	if y := tmdb.ParseYear(d.Year); y != nil {
		year = new(int64(*y))
	}
	return &store.Metadata{
		TMDBID:         d.TMDBID,
		MediaType:      store.MediaType(d.MediaType),
		Title:          d.Title,
		Year:           year,
		Overview:       optional(d.Overview),
		PosterPath:     optional(d.PosterPath),
		IMDbID:         optional(d.IMDbID),
		TMDBRating:     positive(d.VoteAverage),
		TMDBVotes:      positive(int64(d.VoteCount)),
		CollectionID:   positive(d.CollectionID),
		CollectionName: optional(d.CollectionName),
		Genres:         d.Genres,
		Countries:      d.OriginCountry,
	}
}

func toPBShowDetail(show *store.Show) *pb.ShowDetail {
	return &pb.ShowDetail{Show: toPBShow(show), ImdbUrl: imdbURL(show.IMDbID)}
}

func toPBShow(show *store.Show) *pb.Show {
	var priority *int32
	if show.WatchPriority != nil {
		priority = new(clampInt32(*show.WatchPriority))
	}
	return &pb.Show{
		Id:             show.ID,
		TmdbId:         show.TMDBID,
		MediaType:      string(show.MediaType),
		Title:          show.Title,
		Year:           show.Year,
		Genres:         show.Genres,
		Overview:       show.Overview,
		PosterPath:     show.PosterPath,
		ImdbId:         show.IMDbID,
		TmdbRating:     show.TMDBRating,
		TmdbVotes:      show.TMDBVotes,
		Status:         string(show.Status),
		BfRating:       show.BfRating,
		GfRating:       show.GfRating,
		BfComment:      show.BfComment,
		GfComment:      show.GfComment,
		WatchPriority:  priority,
		CollectionId:   show.CollectionID,
		CollectionName: show.CollectionName,
		CreatedAt:      show.CreatedAt,
		UpdatedAt:      show.UpdatedAt,
		OriginCountry:  show.Countries,
	}
}

func toPBShows(shows []store.Show) []*pb.Show {
	out := make([]*pb.Show, 0, len(shows))
	for i := range shows {
		out = append(out, toPBShow(&shows[i]))
	}
	return out
}

func toPBEpisodes(episodes []store.Episode) []*pb.Episode {
	out := make([]*pb.Episode, 0, len(episodes))
	for i := range episodes {
		ep := &episodes[i]
		var runtime *int32
		if ep.Runtime != nil {
			runtime = new(clampInt32(*ep.Runtime))
		}
		out = append(out, &pb.Episode{
			Id:            ep.ID,
			SeasonNumber:  clampInt32(ep.SeasonNumber),
			EpisodeNumber: clampInt32(ep.EpisodeNumber),
			Title:         ep.Title,
			AirDate:       ep.AirDate,
			Runtime:       runtime,
			Watched:       ep.Watched,
		})
	}
	return out
}

func episodesFromSeason(season *tmdb.Season) []store.EpisodeMetadata {
	out := make([]store.EpisodeMetadata, 0, len(season.Episodes))
	for _, ep := range season.Episodes {
		out = append(out, store.EpisodeMetadata{
			SeasonNumber:  int64(ep.SeasonNumber),
			EpisodeNumber: int64(ep.EpisodeNumber),
			Title:         optional(ep.Title),
			AirDate:       optional(ep.AirDate),
			Runtime:       positive(int64(ep.Runtime)),
		})
	}
	return out
}
