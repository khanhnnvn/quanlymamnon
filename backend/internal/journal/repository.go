package journal

import (
	"context"
	"database/sql"
	"encoding/json"
	"strconv"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Insert(ctx context.Context, tenantID, createdBy string, in CreateJournalInput) (Journal, error) {
	photos := in.PhotoURLs
	if photos == nil {
		photos = []string{}
	}
	photosJSON, err := json.Marshal(photos)
	if err != nil {
		return Journal{}, err
	}

	var j Journal
	var photoRaw []byte
	err = r.db.QueryRowContext(ctx, `
		INSERT INTO daily_journals (tenant_id, class_id, student_id, date, content, photo_urls, created_by)
		VALUES ($1, $2, NULLIF($3,'')::uuid, $4, $5, $6, $7)
		RETURNING id, class_id, COALESCE(student_id::text,''), date::text, content, photo_urls, created_by, created_at, updated_at
	`, tenantID, in.ClassID, in.StudentID, in.Date, in.Content, photosJSON, createdBy).
		Scan(&j.ID, &j.ClassID, &j.StudentID, &j.Date, &j.Content, &photoRaw, &j.CreatedBy, &j.CreatedAt, &j.UpdatedAt)
	if err != nil {
		return Journal{}, err
	}
	_ = json.Unmarshal(photoRaw, &j.PhotoURLs)
	return j, nil
}

func (r *Repository) ListByClass(ctx context.Context, tenantID, classID, date string, limit, offset int) ([]Journal, int, error) {
	where := "WHERE tenant_id = $1 AND class_id = $2"
	args := []any{tenantID, classID}
	if date != "" {
		where += " AND date = $3"
		args = append(args, date)
	}

	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM daily_journals `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	limitIdx := len(args) - 1
	offsetIdx := len(args)
	query := `
		SELECT id, class_id, COALESCE(student_id::text,''), date::text, content, photo_urls, created_by, created_at, updated_at
		FROM daily_journals ` + where + placeholderLimitOffset(limitIdx, offsetIdx)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	return scanAll(rows, total)
}

// ListByStudent returns entries tagged directly to studentID plus
// class-wide entries (student_id IS NULL) posted for the student's current
// class — a parent's "nhật ký của con" view needs both, since most journal
// entries are written once per class rather than per child.
func (r *Repository) ListByStudent(ctx context.Context, tenantID, studentID string, limit, offset int) ([]Journal, int, error) {
	const scope = `
		tenant_id = $1 AND (
			student_id = $2
			OR (student_id IS NULL AND class_id = (SELECT current_class_id FROM students WHERE tenant_id = $1 AND id = $2))
		)
	`

	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM daily_journals WHERE `+scope, tenantID, studentID).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, class_id, COALESCE(student_id::text,''), date::text, content, photo_urls, created_by, created_at, updated_at
		FROM daily_journals
		WHERE `+scope+`
		ORDER BY date DESC
		LIMIT $3 OFFSET $4
	`, tenantID, studentID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	return scanAll(rows, total)
}

func scanAll(rows *sql.Rows, total int) ([]Journal, int, error) {
	var out []Journal
	for rows.Next() {
		var j Journal
		var photoRaw []byte
		if err := rows.Scan(&j.ID, &j.ClassID, &j.StudentID, &j.Date, &j.Content, &photoRaw, &j.CreatedBy, &j.CreatedAt, &j.UpdatedAt); err != nil {
			return nil, 0, err
		}
		_ = json.Unmarshal(photoRaw, &j.PhotoURLs)
		if j.PhotoURLs == nil {
			j.PhotoURLs = []string{}
		}
		out = append(out, j)
	}
	return out, total, rows.Err()
}

func placeholderLimitOffset(limitIdx, offsetIdx int) string {
	return " ORDER BY date DESC LIMIT $" + strconv.Itoa(limitIdx) + " OFFSET $" + strconv.Itoa(offsetIdx)
}
