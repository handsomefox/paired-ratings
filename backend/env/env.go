package env

import "os"

type Environment string

const (
	Local      Environment = "local"
	Production Environment = "production"

	Key string = "ENV"
)

func (e Environment) Valid() bool {
	switch e {
	case Local, Production:
		return true
	}
	return false
}

var Current Environment = Local

func init() {
	v := os.Getenv(Key)
	Current = Environment(v)
	if !Current.Valid() {
		Current = Local
	}
}
