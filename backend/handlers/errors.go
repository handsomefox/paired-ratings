package handlers

import (
	"database/sql"
	"errors"
	"net/http"
)

func isNoRows(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}

func badRequest(msg string) error   { return &Error{Status: http.StatusBadRequest, Message: msg} }
func unauthorized(msg string) error { return &Error{Status: http.StatusUnauthorized, Message: msg} }
func notFound(msg string) error     { return &Error{Status: http.StatusNotFound, Message: msg} }
func internal(err error) error      { return err }
