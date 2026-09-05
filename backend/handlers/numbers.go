package handlers

import "math"

// clampInt32 keeps counts and external metadata within the API's integer range.
func clampInt32(value int) int32 {
	if value > math.MaxInt32 {
		return math.MaxInt32
	}
	if value < math.MinInt32 {
		return math.MinInt32
	}
	return int32(value)
}
