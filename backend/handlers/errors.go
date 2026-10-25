package handlers

import (
	"net/http"
	"strconv"
)

// Error is an error with the status and message the client receives. Any other
// error becomes a 500 with a generic message, so internal details stay in the
// log.
type Error struct {
	// Err is the cause. It is logged and never sent to the client.
	Err     error
	Message string
	Status  int
}

func (e *Error) Error() string {
	msg := e.Message + " code=" + strconv.Itoa(e.Status)
	if e.Err != nil {
		msg += ": " + e.Err.Error()
	}
	return msg
}

func (e *Error) Unwrap() error { return e.Err }

func badRequest(msg string) error   { return &Error{Status: http.StatusBadRequest, Message: msg} }
func unauthorized(msg string) error { return &Error{Status: http.StatusUnauthorized, Message: msg} }
func notFound() error               { return &Error{Status: http.StatusNotFound, Message: "not found"} }

func tooManyRequests(msg string) error {
	return &Error{Status: http.StatusTooManyRequests, Message: msg}
}

// badGateway reports a failed TMDB request.
func badGateway(err error) error {
	return &Error{Status: http.StatusBadGateway, Message: "TMDB request failed", Err: err}
}
