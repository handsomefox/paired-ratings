package handlers

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"testing/synctest"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/handsomefox/paired-ratings/backend/gen/pb"
	"github.com/handsomefox/paired-ratings/backend/store"
	"github.com/handsomefox/paired-ratings/backend/tmdb"
	"github.com/handsomefox/paired-ratings/backend/tmdb/tmdbtest"
)

func TestSyncAllSeasonsReportsPartialFailure(t *testing.T) {
	st := newTestStore(t)
	showID := addTestShow(t, st, 1, store.MediaTV)
	fetchErr := errors.New("TMDB unavailable")
	var calls []int
	h := newTestHandler(t, st, &tmdbtest.Mock{
		FetchSeasonFunc: func(_ context.Context, _ int64, season int) (tmdb.Season, error) {
			calls = append(calls, season)
			if season == 1 {
				return tmdb.Season{}, fetchErr
			}
			return tmdb.Season{Episodes: []tmdb.Episode{{SeasonNumber: season, EpisodeNumber: 1}}}, nil
		},
	})

	err := h.syncAllSeasons(t.Context(), showID, 1, 2, false)
	require.ErrorIs(t, err, fetchErr)
	require.ErrorContains(t, err, "season 1")
	assert.Equal(t, []int{1, 2}, calls)
	episodes, err := st.ListEpisodes(t.Context(), showID)
	require.NoError(t, err)
	require.Len(t, episodes, 1)
	assert.Equal(t, int64(2), episodes[0].SeasonNumber)
}

func TestSyncAllSeasonsStopsOnCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	calls := 0
	h := &Handler{tmdb: &tmdbtest.Mock{
		FetchSeasonFunc: func(context.Context, int64, int) (tmdb.Season, error) {
			calls++
			cancel()
			return tmdb.Season{}, ctx.Err()
		},
	}}
	require.ErrorIs(t, h.syncAllSeasons(ctx, 1, 1, 10, false), context.Canceled)
	assert.Equal(t, 1, calls)
}

func TestEpisodesStayReadableWhileTMDBIsDown(t *testing.T) {
	st := newTestStore(t)
	id := addTestShow(t, st, 1, store.MediaTV)
	tmdbDown := errors.New("TMDB unavailable")
	c := newClient(t, st, &tmdbtest.Mock{
		FetchDetailsFunc: func(context.Context, int64, string) (*tmdb.Detail, error) { return nil, tmdbDown },
	})

	// Nothing stored yet, so the first read needs TMDB.
	assert.Equal(t, http.StatusBadGateway, c.do(http.MethodGet, showPath(id, "/episodes"), nil).Code)

	require.NoError(t, st.SyncEpisodes(t.Context(), id, []store.EpisodeMetadata{
		{SeasonNumber: 1, EpisodeNumber: 1}, {SeasonNumber: 2, EpisodeNumber: 1},
	}))
	got := decode[pb.EpisodesResponse](t, c.do(http.MethodGet, showPath(id, "/episodes"), nil), http.StatusOK)
	assert.Len(t, got.Episodes, 2)
	assert.Equal(t, int32(2), got.TotalSeasons)

	assert.Equal(t, http.StatusNoContent, c.do(http.MethodPost, "/shows/episodes/"+
		formatID(got.Episodes[0].Id)+"/toggle", &pb.ToggleEpisodeRequest{Watched: true}).Code)
	assert.Equal(t, http.StatusNoContent, c.do(http.MethodPost, showPath(id, "/episodes/season/2/toggle"),
		&pb.ToggleEpisodeRequest{Watched: true}).Code)
	assert.Equal(t, http.StatusNotFound, c.do(http.MethodPost, showPath(id, "/episodes/season/9/toggle"),
		&pb.ToggleEpisodeRequest{Watched: true}).Code)

	movie := addTestShow(t, st, 2, store.MediaMovie)
	assert.Equal(t, http.StatusBadRequest, c.do(http.MethodGet, showPath(movie, "/episodes"), nil).Code)
}

// TestFetchDetailsStopsWhenTheReaderLeaves checks that cancelling the refresh
// ends every worker, even when the reader stops before draining the results.
func TestFetchDetailsStopsWhenTheReaderLeaves(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		h := &Handler{tmdb: &tmdbtest.Mock{
			FetchDetailsFunc: func(_ context.Context, id int64, mediaType string) (*tmdb.Detail, error) {
				return &tmdb.Detail{TMDBID: id, MediaType: mediaType}, nil
			},
		}}
		shows := make([]store.StaleShow, 50)
		ctx, cancel := context.WithCancel(t.Context())

		results := h.fetchDetails(ctx, shows)
		<-results
		synctest.Wait()
		cancel()
		// synctest.Test fails if any goroutine started here is still blocked.
	})
}
