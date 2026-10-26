// Package tmdb wraps TMDB API calls and response shaping.
package tmdb

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/handsomefox/paired-ratings/backend/logger"
)

const (
	defaultBaseURL = "https://api.themoviedb.org/3"
	requestTimeout = 10 * time.Second

	// MaxPage is the last result page TMDB serves.
	MaxPage = 500
)

var errMediaType = errors.New("invalid media type")

// validMediaType reports whether mediaType names a TMDB movie or tv endpoint.
func validMediaType(mediaType string) bool {
	return mediaType == "movie" || mediaType == "tv"
}

type Client struct {
	http        *http.Client
	baseURL     string
	accessToken string
}

// New returns a client that authenticates with a TMDB API Read Access Token,
// sent as a Bearer header on every request.
func New(accessToken string) *Client {
	return &Client{
		accessToken: strings.TrimSpace(accessToken),
		baseURL:     defaultBaseURL,
		http:        &http.Client{Timeout: requestTimeout},
	}
}

func (c *Client) doJSON(ctx context.Context, endpoint string, dst any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, http.NoBody)
	if err != nil {
		return err
	}

	if c.accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.accessToken)
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := resp.Body.Close(); cerr != nil {
			slog.Warn("tmdb: close response failed", logger.Error(cerr))
		}
	}()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("tmdb %s: %s", req.URL.Path, resp.Status)
	}

	return json.NewDecoder(resp.Body).Decode(dst)
}

func yearFromDate(date string) string {
	if len(date) < 4 {
		return ""
	}
	return date[:4]
}
