// Package env reads the application mode once during initialization.
package env

import (
	"fmt"
	"os"
)

type Environment string

const (
	Local      Environment = "local"
	Production Environment = "production"

	key string = "ENV"
)

func (e Environment) Valid() bool {
	return e == Local || e == Production
}

var (
	raw = os.Getenv(key)

	// Current is the mode. An unset ENV means Local; Check rejects any other
	// unknown value, so a typo cannot quietly run production in local mode.
	Current = Local
)

func init() {
	if e := Environment(raw); e.Valid() {
		Current = e
	}
}

// Check reports an ENV value that is set but not recognized.
func Check() error {
	if raw != "" && !Environment(raw).Valid() {
		return fmt.Errorf("%s=%q is not %q or %q", key, raw, Local, Production)
	}
	return nil
}

func IsLocal() bool {
	return Current == Local
}

func IsProduction() bool {
	return Current == Production
}
