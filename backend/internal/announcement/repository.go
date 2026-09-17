package announcement

import (
	"context"
	"database/sql"
	"strconv"
	"strings"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Insert(ctx context.Context, tenantID, createdBy string, in CreateAnnouncementInput) (Announcement, error) {
	var a Announcement
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO announcements (tenant_id, title, content, audience, grade_id, class_id, is_urgent, created_by, published_at)
		VALUES ($1, $2, $3, $4, NULLIF($5,'')::uuid, NULLIF($6,'')::uuid, $7, $8, CASE WHEN $9 THEN now() ELSE NULL END)
		RETURNING id, title, content, audience, COALESCE(grade_id::text,''), COALESCE(class_id::text,''), is_urgent,
			created_by, published_at, created_at
	`, tenantID, in.Title, in.Content, in.Audience, in.GradeID, in.ClassID, in.IsUrgent, createdBy, in.Publish).
		Scan(&a.ID, &a.Title, &a.Content, &a.Audience, &a.GradeID, &a.ClassID, &a.IsUrgent, &a.CreatedBy, &a.PublishedAt, &a.CreatedAt)
	return a, err
}

// ListAll returns every announcement in the tenant (Admin/Vice view).
func (r *Repository) ListAll(ctx context.Context, tenantID string, limit, offset int) ([]Announcement, int, error) {
	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM announcements WHERE tenant_id = $1`, tenantID).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, title, content, audience, COALESCE(grade_id::text,''), COALESCE(class_id::text,''), is_urgent,
			created_by, published_at, created_at
		FROM announcements WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, tenantID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	return scanAll(rows, total)
}

// ListForTeacher returns school-wide announcements plus any targeting the
// given grade ids or class ids (a Teacher's "lớp mình" + school-wide view).
func (r *Repository) ListForTeacher(ctx context.Context, tenantID string, gradeIDs, classIDs []string, limit, offset int) ([]Announcement, int, error) {
	where := "WHERE tenant_id = $1 AND (audience = 'school'"
	args := []any{tenantID}

	if len(gradeIDs) > 0 {
		ph := placeholders(&args, gradeIDs)
		where += " OR (audience = 'grade' AND grade_id IN (" + ph + "))"
	}
	if len(classIDs) > 0 {
		ph := placeholders(&args, classIDs)
		where += " OR (audience = 'class' AND class_id IN (" + ph + "))"
	}
	where += ")"

	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM announcements `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	query := `
		SELECT id, title, content, audience, COALESCE(grade_id::text,''), COALESCE(class_id::text,''), is_urgent,
			created_by, published_at, created_at
		FROM announcements ` + where + ` ORDER BY created_at DESC LIMIT $` + strconv.Itoa(len(args)-1) + ` OFFSET $` + strconv.Itoa(len(args))

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	return scanAll(rows, total)
}

func placeholders(args *[]any, values []string) string {
	ph := make([]string, len(values))
	for i, v := range values {
		*args = append(*args, v)
		ph[i] = "$" + strconv.Itoa(len(*args))
	}
	return strings.Join(ph, ",")
}

func scanAll(rows *sql.Rows, total int) ([]Announcement, int, error) {
	var out []Announcement
	for rows.Next() {
		var a Announcement
		if err := rows.Scan(&a.ID, &a.Title, &a.Content, &a.Audience, &a.GradeID, &a.ClassID, &a.IsUrgent,
			&a.CreatedBy, &a.PublishedAt, &a.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, a)
	}
	return out, total, rows.Err()
}
