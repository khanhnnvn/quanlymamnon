package db

import (
	"database/sql"
	"fmt"
	"io/fs"
	"log"
	"sort"
	"strings"

	"mamnon/backend/migrations"
)

// RunMigrations applies every *.sql file embedded in the migrations package
// that has not yet been recorded in schema_migrations, in filename order.
// It is idempotent: re-running it on an already-migrated database is a
// no-op and never errors.
func RunMigrations(conn *sql.DB) error {
	if err := ensureMigrationsTable(conn); err != nil {
		return fmt.Errorf("ensure schema_migrations table: %w", err)
	}

	applied, err := appliedVersions(conn)
	if err != nil {
		return fmt.Errorf("load applied migrations: %w", err)
	}

	entries, err := fs.ReadDir(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	var names []string
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		names = append(names, e.Name())
	}
	sort.Strings(names)

	for _, name := range names {
		if applied[name] {
			continue
		}

		content, err := migrations.FS.ReadFile(name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}

		if err := applyMigration(conn, name, string(content)); err != nil {
			return fmt.Errorf("apply migration %s: %w", name, err)
		}

		log.Printf("migration applied: %s", name)
	}

	return nil
}

func ensureMigrationsTable(conn *sql.DB) error {
	_, err := conn.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version     TEXT PRIMARY KEY,
			applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`)
	return err
}

func appliedVersions(conn *sql.DB) (map[string]bool, error) {
	rows, err := conn.Query(`SELECT version FROM schema_migrations`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[string]bool)
	for rows.Next() {
		var version string
		if err := rows.Scan(&version); err != nil {
			return nil, err
		}
		applied[version] = true
	}
	return applied, rows.Err()
}

func applyMigration(conn *sql.DB, name, sqlText string) error {
	tx, err := conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck // no-op once committed

	if _, err := tx.Exec(sqlText); err != nil {
		return err
	}

	if _, err := tx.Exec(`INSERT INTO schema_migrations (version) VALUES ($1)`, name); err != nil {
		return err
	}

	return tx.Commit()
}
