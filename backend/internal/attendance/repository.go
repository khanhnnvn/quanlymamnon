package attendance

import (
	"context"
	"database/sql"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Upsert(ctx context.Context, tenantID, recordedBy string, in RecordInput) (Attendance, error) {
	var a Attendance
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO attendance (tenant_id, student_id, class_id, date, status, check_in_time, check_out_time, picked_up_by, note, recorded_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, NULLIF($8,''), NULLIF($9,''), $10)
		ON CONFLICT (tenant_id, student_id, date) DO UPDATE SET
			class_id = EXCLUDED.class_id,
			status = EXCLUDED.status,
			check_in_time = EXCLUDED.check_in_time,
			check_out_time = EXCLUDED.check_out_time,
			picked_up_by = EXCLUDED.picked_up_by,
			note = EXCLUDED.note,
			recorded_by = EXCLUDED.recorded_by,
			updated_at = now()
		RETURNING id, student_id, class_id, date::text, status, check_in_time, check_out_time,
			COALESCE(picked_up_by,''), COALESCE(note,''), recorded_by, created_at, updated_at
	`, tenantID, in.StudentID, in.ClassID, in.Date, in.Status, in.CheckInTime, in.CheckOutTime, in.PickedUpBy, in.Note, recordedBy).
		Scan(&a.ID, &a.StudentID, &a.ClassID, &a.Date, &a.Status, &a.CheckInTime, &a.CheckOutTime,
			&a.PickedUpBy, &a.Note, &a.RecordedBy, &a.CreatedAt, &a.UpdatedAt)
	return a, err
}

func (r *Repository) ListByClassDate(ctx context.Context, tenantID, classID, date string, limit, offset int) ([]Attendance, int, error) {
	var total int
	if err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM attendance WHERE tenant_id = $1 AND class_id = $2 AND date = $3
	`, tenantID, classID, date).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, student_id, class_id, date::text, status, check_in_time, check_out_time,
			COALESCE(picked_up_by,''), COALESCE(note,''), recorded_by, created_at, updated_at
		FROM attendance
		WHERE tenant_id = $1 AND class_id = $2 AND date = $3
		ORDER BY created_at
		LIMIT $4 OFFSET $5
	`, tenantID, classID, date, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	return scanAll(rows, total)
}

func (r *Repository) ListByStudent(ctx context.Context, tenantID, studentID string, limit, offset int) ([]Attendance, int, error) {
	var total int
	if err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM attendance WHERE tenant_id = $1 AND student_id = $2
	`, tenantID, studentID).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, student_id, class_id, date::text, status, check_in_time, check_out_time,
			COALESCE(picked_up_by,''), COALESCE(note,''), recorded_by, created_at, updated_at
		FROM attendance
		WHERE tenant_id = $1 AND student_id = $2
		ORDER BY date DESC
		LIMIT $3 OFFSET $4
	`, tenantID, studentID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	return scanAll(rows, total)
}

func scanAll(rows *sql.Rows, total int) ([]Attendance, int, error) {
	var out []Attendance
	for rows.Next() {
		var a Attendance
		if err := rows.Scan(&a.ID, &a.StudentID, &a.ClassID, &a.Date, &a.Status, &a.CheckInTime, &a.CheckOutTime,
			&a.PickedUpBy, &a.Note, &a.RecordedBy, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, a)
	}
	return out, total, rows.Err()
}
