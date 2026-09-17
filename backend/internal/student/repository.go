package student

import (
	"context"
	"database/sql"
	"strconv"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Insert(ctx context.Context, tenantID string, in CreateStudentInput) (Student, error) {
	status := in.Status
	if status == "" {
		status = "enrolled"
	}

	var s Student
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO students (tenant_id, full_name, dob, gender, avatar_url, current_class_id, status, enrollment_date, note)
		VALUES ($1, $2, NULLIF($3,'')::date, NULLIF($4,''), NULLIF($5,''), NULLIF($6,'')::uuid, $7, NULLIF($8,'')::date, NULLIF($9,''))
		RETURNING id, full_name, COALESCE(dob::text,''), COALESCE(gender,''), COALESCE(avatar_url,''),
			COALESCE(current_class_id::text,''), status, COALESCE(enrollment_date::text,''), COALESCE(note,''),
			created_at, updated_at
	`, tenantID, in.FullName, in.DOB, in.Gender, in.AvatarURL, in.CurrentClassID, status, in.EnrollmentDate, in.Note).
		Scan(&s.ID, &s.FullName, &s.DOB, &s.Gender, &s.AvatarURL, &s.CurrentClassID, &s.Status, &s.EnrollmentDate, &s.Note,
			&s.CreatedAt, &s.UpdatedAt)
	return s, err
}

// List returns students in tenantID, optionally filtered to classID (empty
// = no filter, used by Admin/Vice; non-empty enforces a Teacher's "lớp
// mình" scope).
func (r *Repository) List(ctx context.Context, tenantID, classID string, limit, offset int) ([]Student, int, error) {
	where := "WHERE tenant_id = $1 AND deleted_at IS NULL"
	args := []any{tenantID}
	if classID != "" {
		args = append(args, classID)
		where += " AND current_class_id = $" + strconv.Itoa(len(args))
	}

	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM students `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	query := `
		SELECT id, full_name, COALESCE(dob::text,''), COALESCE(gender,''), COALESCE(avatar_url,''),
			COALESCE(current_class_id::text,''), status, COALESCE(enrollment_date::text,''), COALESCE(note,''),
			created_at, updated_at
		FROM students ` + where + ` ORDER BY full_name ASC LIMIT $` + strconv.Itoa(len(args)-1) + ` OFFSET $` + strconv.Itoa(len(args))

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []Student
	for rows.Next() {
		var s Student
		if err := rows.Scan(&s.ID, &s.FullName, &s.DOB, &s.Gender, &s.AvatarURL, &s.CurrentClassID, &s.Status,
			&s.EnrollmentDate, &s.Note, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, s)
	}
	return out, total, rows.Err()
}

func (r *Repository) GetByID(ctx context.Context, tenantID, id string) (Student, error) {
	var s Student
	err := r.db.QueryRowContext(ctx, `
		SELECT id, full_name, COALESCE(dob::text,''), COALESCE(gender,''), COALESCE(avatar_url,''),
			COALESCE(current_class_id::text,''), status, COALESCE(enrollment_date::text,''), COALESCE(note,''),
			created_at, updated_at
		FROM students WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, tenantID, id).Scan(&s.ID, &s.FullName, &s.DOB, &s.Gender, &s.AvatarURL, &s.CurrentClassID, &s.Status,
		&s.EnrollmentDate, &s.Note, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return Student{}, err
	}

	parents, err := r.ParentsForStudent(ctx, tenantID, id)
	if err != nil {
		return Student{}, err
	}
	s.Parents = parents
	return s, nil
}

// Update applies a partial update to a student. Returns sql.ErrNoRows if no
// student matches (tenantID, id).
func (r *Repository) Update(ctx context.Context, tenantID, id string, in UpdateStudentInput) (Student, error) {
	var s Student
	err := r.db.QueryRowContext(ctx, `
		UPDATE students SET
			full_name = COALESCE($3, full_name),
			dob = COALESCE(NULLIF($4,'')::date, dob),
			gender = COALESCE(NULLIF($5,''), gender),
			avatar_url = COALESCE(NULLIF($6,''), avatar_url),
			current_class_id = CASE WHEN $7::text IS NULL THEN current_class_id ELSE NULLIF($7,'')::uuid END,
			status = COALESCE($8, status),
			enrollment_date = COALESCE(NULLIF($9,'')::date, enrollment_date),
			note = COALESCE($10, note),
			updated_at = now()
		WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
		RETURNING id, full_name, COALESCE(dob::text,''), COALESCE(gender,''), COALESCE(avatar_url,''),
			COALESCE(current_class_id::text,''), status, COALESCE(enrollment_date::text,''), COALESCE(note,''),
			created_at, updated_at
	`, tenantID, id, in.FullName, in.DOB, in.Gender, in.AvatarURL, in.CurrentClassID, in.Status, in.EnrollmentDate, in.Note).
		Scan(&s.ID, &s.FullName, &s.DOB, &s.Gender, &s.AvatarURL, &s.CurrentClassID, &s.Status,
			&s.EnrollmentDate, &s.Note, &s.CreatedAt, &s.UpdatedAt)
	if err != nil {
		return Student{}, err
	}
	parents, err := r.ParentsForStudent(ctx, tenantID, id)
	if err != nil {
		return Student{}, err
	}
	s.Parents = parents
	return s, nil
}

func (r *Repository) ParentsForStudent(ctx context.Context, tenantID, studentID string) ([]ParentLink, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT sp.parent_user_id, u.full_name, COALESCE(sp.relationship,''), sp.is_primary_contact, sp.can_pickup
		FROM student_parents sp
		JOIN users u ON u.id = sp.parent_user_id
		WHERE sp.tenant_id = $1 AND sp.student_id = $2
	`, tenantID, studentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ParentLink{}
	for rows.Next() {
		var p ParentLink
		if err := rows.Scan(&p.ParentUserID, &p.FullName, &p.Relationship, &p.IsPrimaryContact, &p.CanPickup); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Repository) LinkParent(ctx context.Context, tenantID, studentID string, in LinkParentInput) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO student_parents (tenant_id, student_id, parent_user_id, relationship, is_primary_contact, can_pickup)
		VALUES ($1, $2, $3, NULLIF($4,''), $5, $6)
		ON CONFLICT (student_id, parent_user_id) DO UPDATE SET
			relationship = EXCLUDED.relationship,
			is_primary_contact = EXCLUDED.is_primary_contact,
			can_pickup = EXCLUDED.can_pickup
	`, tenantID, studentID, in.ParentUserID, in.Relationship, in.IsPrimaryContact, in.CanPickup)
	return err
}
