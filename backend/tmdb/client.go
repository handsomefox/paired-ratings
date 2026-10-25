// Package tmdb wraps TMDB API calls and response shaping.
package tmdb

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/handsomefox/paired-ratings/backend/logger"
)

const (
	baseURL               = "https://api.themoviedb.org/3"
	defaultRequestTimeout = 8 * time.Second
)

type Client struct {
	http        *http.Client
	accessToken string
}

// New returns a client that authenticates with a TMDB API Read Access Token,
// sent as a Bearer header on every request.
func New(accessToken string) *Client {
	return &Client{
		accessToken: strings.TrimSpace(accessToken),
		http: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func withTimeout(ctx context.Context) (context.Context, context.CancelFunc) {
	if _, ok := ctx.Deadline(); ok {
		return ctx, func() {}
	}
	return context.WithTimeout(ctx, defaultRequestTimeout)
}

func (c *Client) doJSON(ctx context.Context, endpoint string, dst any) error {
	ctx, cancel := withTimeout(ctx)
	defer cancel()

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
