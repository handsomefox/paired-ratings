// Command convert-legacy copies a database in the schema from before the
// 001_schema baseline into a new file, then checks every row of the copy
// against the source. It is a one-off for moving production to the new schema;
// delete it with backend/store/legacy.go once that is done.
//
//	go run ./backend/cmd/convert-legacy -src old.db -dst new.db
//
// src must be a local copy: SQLite cannot share a WAL database across machines,
// and opening it may checkpoint the WAL into the main file.
package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"

	"github.com/handsomefox/paired-ratings/backend/store"
)

func main() {
	src := flag.String("src", "", "local copy of the legacy database")
	dst := flag.String("dst", "", "path for the new database; must not exist")
	flag.Parse()

	if err := run(*src, *dst); err != nil {
		fmt.Fprintln(os.Stderr, "convert-legacy:", err)
		os.Exit(1)
	}
}

func run(src, dst string) error {
	if src == "" || dst == "" {
		return errors.New("both -src and -dst are required")
	}

	report, err := store.ConvertLegacy(context.Background(), src, dst)
	if err != nil {
		return err
	}
	sum, err := fileSHA256(dst)
	if err != nil {
		return err
	}

	fmt.Printf("shows copied:            %d\n", report.Shows)
	fmt.Printf("episodes copied:         %d\n", report.Episodes)
	fmt.Printf("orphan episodes skipped: %d\n", report.OrphanEpisodes)
	fmt.Printf("empty comments cleared:  %d\n", report.EmptyComments)
	fmt.Printf("verified, sha256 %s  %s\n", sum, dst)
	return nil
}

func fileSHA256(path string) (string, error) {
	f, err := os.Open(path) //nolint:gosec // The operator names the file on the command line.
	if err != nil {
		return "", err
	}
	defer f.Close() //nolint:errcheck // Read-only file; a close error cannot lose data.

	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
