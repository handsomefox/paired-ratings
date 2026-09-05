// Package tmdb wraps TMDB API calls and response shaping.
package tmdb

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/handsomefox/paired-ratings/backend/logger"
)

const (
	baseURL               = "https://api.themoviedb.org/3"
	defaultRequestTimeout = 8 * time.Second
)

type Client struct {
	http      *http.Client
	apiKey    string
	readToken string
}

func New(apiKey, readToken string) *Client {
	if strings.TrimSpace(readToken) == "" && looksLikeJWT(apiKey) {
		readToken = apiKey
		apiKey = ""
	}
	return &Client{
		apiKey:    strings.TrimSpace(apiKey),
		readToken: strings.TrimSpace(readToken),
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

func (c *Client) doJSON(ctx context.Context, method, endpoint string, dst any) error {
	ctx, cancel := withTimeout(ctx)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, method, endpoint, http.NoBody)
	if err != nil {
		return err
	}

	c.applyAuth(req)

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
		return fmt.Errorf("tmdb request failed: %s", resp.Status)
	}

	return json.NewDecoder(resp.Body).Decode(dst)
}

func (c *Client) maybeSetAPIKey(values url.Values) {
	if c.apiKey != "" {
		values.Set("api_key", c.apiKey)
	}
}

func (c *Client) applyAuth(req *http.Request) {
	if strings.TrimSpace(c.readToken) == "" {
		return
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(c.readToken))
}

func yearFromDate(date string) string {
	if len(date) < 4 {
		return ""
	}
	return date[:4]
}

func looksLikeJWT(token string) bool {
	parts := strings.Split(strings.TrimSpace(token), ".")
	return len(parts) == 3 && len(token) > 80
}
