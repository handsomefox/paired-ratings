package store

import "context"

// Backup writes a consistent snapshot, including committed WAL transactions.
// The destination must not exist or must be empty.
func (s *Store) Backup(ctx context.Context, destination string) error {
	_, err := s.sqldb.ExecContext(ctx, "VACUUM INTO ?", destination)
	return err
}
