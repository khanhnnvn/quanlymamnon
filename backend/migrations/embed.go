// Package migrations embeds the SQL migration files into the backend binary
// so the migration runner (internal/db) can apply them without needing the
// migrations/ directory to be present on disk at deploy time.
package migrations

import "embed"

//go:embed *.sql
var FS embed.FS
