package school

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

// ---- school_years ----

func (r *Repository) InsertSchoolYear(ctx context.Context, tenantID string, in CreateSchoolYearInput) (SchoolYear, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return SchoolYear{}, err
	}
	defer tx.Rollback() //nolint:errcheck

	if in.IsCurrent {
		if _, err := tx.ExecContext(ctx, `UPDATE school_years SET is_current = false WHERE tenant_id = $1`, tenantID); err != nil {
			return SchoolYear{}, err
		}
	}

	var sy SchoolYear
	err = tx.QueryRowContext(ctx, `
		INSERT INTO school_years (tenant_id, name, start_date, end_date, is_current)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, name, start_date::text, end_date::text, is_current, created_at, updated_at
	`, tenantID, in.Name, in.StartDate, in.EndDate, in.IsCurrent).
		Scan(&sy.ID, &sy.Name, &sy.StartDate, &sy.EndDate, &sy.IsCurrent, &sy.CreatedAt, &sy.UpdatedAt)
	if err != nil {
		return SchoolYear{}, err
	}

	return sy, tx.Commit()
}

func (r *Repository) ListSchoolYears(ctx context.Context, tenantID string, limit, offset int) ([]SchoolYear, int, error) {
	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM school_years WHERE tenant_id = $1`, tenantID).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, start_date::text, end_date::text, is_current, created_at, updated_at
		FROM school_years WHERE tenant_id = $1
		ORDER BY start_date DESC
		LIMIT $2 OFFSET $3
	`, tenantID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []SchoolYear
	for rows.Next() {
		var sy SchoolYear
		if err := rows.Scan(&sy.ID, &sy.Name, &sy.StartDate, &sy.EndDate, &sy.IsCurrent, &sy.CreatedAt, &sy.UpdatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, sy)
	}
	return out, total, rows.Err()
}

func (r *Repository) UpdateSchoolYear(ctx context.Context, tenantID, id string, in UpdateSchoolYearInput) (SchoolYear, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return SchoolYear{}, err
	}
	defer tx.Rollback() //nolint:errcheck

	if in.IsCurrent != nil && *in.IsCurrent {
		if _, err := tx.ExecContext(ctx, `UPDATE school_years SET is_current = false WHERE tenant_id = $1`, tenantID); err != nil {
			return SchoolYear{}, err
		}
	}

	var sy SchoolYear
	err = tx.QueryRowContext(ctx, `
		UPDATE school_years SET
			name = COALESCE($3, name),
			start_date = COALESCE($4, start_date),
			end_date = COALESCE($5, end_date),
			is_current = COALESCE($6, is_current),
			updated_at = now()
		WHERE tenant_id = $1 AND id = $2
		RETURNING id, name, start_date::text, end_date::text, is_current, created_at, updated_at
	`, tenantID, id, in.Name, in.StartDate, in.EndDate, in.IsCurrent).
		Scan(&sy.ID, &sy.Name, &sy.StartDate, &sy.EndDate, &sy.IsCurrent, &sy.CreatedAt, &sy.UpdatedAt)
	if err != nil {
		return SchoolYear{}, err
	}

	return sy, tx.Commit()
}

// ---- grades ----

func (r *Repository) InsertGrade(ctx context.Context, tenantID string, in CreateGradeInput) (Grade, error) {
	var g Grade
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO grades (tenant_id, name, sort_order)
		VALUES ($1, $2, $3)
		RETURNING id, name, sort_order, created_at
	`, tenantID, in.Name, in.SortOrder).Scan(&g.ID, &g.Name, &g.SortOrder, &g.CreatedAt)
	return g, err
}

func (r *Repository) ListGrades(ctx context.Context, tenantID string, limit, offset int) ([]Grade, int, error) {
	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM grades WHERE tenant_id = $1`, tenantID).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, sort_order, created_at FROM grades WHERE tenant_id = $1
		ORDER BY sort_order ASC, name ASC
		LIMIT $2 OFFSET $3
	`, tenantID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []Grade
	for rows.Next() {
		var g Grade
		if err := rows.Scan(&g.ID, &g.Name, &g.SortOrder, &g.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, g)
	}
	return out, total, rows.Err()
}

// ---- classes ----

func (r *Repository) GetClassByID(ctx context.Context, tenantID, classID string) (Class, error) {
	var cl Class
	err := r.db.QueryRowContext(ctx, `
		SELECT id, school_year_id, grade_id, name, capacity, created_at, updated_at
		FROM classes WHERE tenant_id = $1 AND id = $2
	`, tenantID, classID).Scan(&cl.ID, &cl.SchoolYearID, &cl.GradeID, &cl.Name, &cl.Capacity, &cl.CreatedAt, &cl.UpdatedAt)
	return cl, err
}

func (r *Repository) InsertClass(ctx context.Context, tenantID string, in CreateClassInput) (Class, error) {
	var cl Class
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO classes (tenant_id, school_year_id, grade_id, name, capacity)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, school_year_id, grade_id, name, capacity, created_at, updated_at
	`, tenantID, in.SchoolYearID, in.GradeID, in.Name, in.Capacity).
		Scan(&cl.ID, &cl.SchoolYearID, &cl.GradeID, &cl.Name, &cl.Capacity, &cl.CreatedAt, &cl.UpdatedAt)
	if err != nil {
		return Class{}, err
	}
	cl.Teachers = []ClassTeacherRef{}
	return cl, nil
}

// UpdateClass applies a partial update to a class. Returns sql.ErrNoRows if
// no class matches (tenantID, id).
func (r *Repository) UpdateClass(ctx context.Context, tenantID, id string, in UpdateClassInput) (Class, error) {
	var cl Class
	err := r.db.QueryRowContext(ctx, `
		UPDATE classes SET
			name = COALESCE($3, name),
			grade_id = COALESCE($4, grade_id),
			capacity = COALESCE($5, capacity),
			updated_at = now()
		WHERE tenant_id = $1 AND id = $2
		RETURNING id, school_year_id, grade_id, name, capacity, created_at, updated_at
	`, tenantID, id, in.Name, in.GradeID, in.Capacity).
		Scan(&cl.ID, &cl.SchoolYearID, &cl.GradeID, &cl.Name, &cl.Capacity, &cl.CreatedAt, &cl.UpdatedAt)
	return cl, err
}

// ListClasses lists classes in tenantID, optionally restricted to
// onlyClassIDs (used for Teacher/Assistant "lớp mình" scoping — nil/empty
// means no restriction).
func (r *Repository) ListClasses(ctx context.Context, tenantID string, onlyClassIDs []string, limit, offset int) ([]Class, int, error) {
	where := "WHERE tenant_id = $1"
	args := []any{tenantID}

	if onlyClassIDs != nil {
		if len(onlyClassIDs) == 0 {
			return []Class{}, 0, nil
		}
		placeholders := make([]string, len(onlyClassIDs))
		for i, id := range onlyClassIDs {
			args = append(args, id)
			placeholders[i] = "$" + strconv.Itoa(len(args))
		}
		where += " AND id IN (" + strings.Join(placeholders, ",") + ")"
	}

	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM classes `+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	query := `SELECT id, school_year_id, grade_id, name, capacity, created_at, updated_at FROM classes ` + where +
		` ORDER BY name ASC LIMIT $` + strconv.Itoa(len(args)-1) + ` OFFSET $` + strconv.Itoa(len(args))

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []Class
	for rows.Next() {
		var cl Class
		if err := rows.Scan(&cl.ID, &cl.SchoolYearID, &cl.GradeID, &cl.Name, &cl.Capacity, &cl.CreatedAt, &cl.UpdatedAt); err != nil {
			return nil, 0, err
		}
		cl.Teachers = []ClassTeacherRef{}
		out = append(out, cl)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	for i := range out {
		teachers, err := r.TeachersForClass(ctx, tenantID, out[i].ID)
		if err != nil {
			return nil, 0, err
		}
		out[i].Teachers = teachers
	}

	return out, total, nil
}

func (r *Repository) TeachersForClass(ctx context.Context, tenantID, classID string) ([]ClassTeacherRef, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT ct.user_id, u.full_name, ct.role_in_class
		FROM class_teachers ct
		JOIN users u ON u.id = ct.user_id
		WHERE ct.tenant_id = $1 AND ct.class_id = $2
		ORDER BY ct.role_in_class
	`, tenantID, classID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ClassTeacherRef{}
	for rows.Next() {
		var t ClassTeacherRef
		if err := rows.Scan(&t.UserID, &t.FullName, &t.RoleInClass); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

func (r *Repository) ClassExists(ctx context.Context, tenantID, classID string) (bool, error) {
	var exists bool
	err := r.db.QueryRowContext(ctx, `
		SELECT EXISTS (SELECT 1 FROM classes WHERE tenant_id = $1 AND id = $2)
	`, tenantID, classID).Scan(&exists)
	return exists, err
}

// AssignTeacher upserts a class_teachers row for (class_id, user_id).
func (r *Repository) AssignTeacher(ctx context.Context, tenantID, classID string, in AssignTeacherInput) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO class_teachers (tenant_id, class_id, user_id, role_in_class)
		VALUES ($1, $2, $3, $4)
		ON CONFLICT (class_id, user_id) DO UPDATE SET role_in_class = EXCLUDED.role_in_class
	`, tenantID, classID, in.UserID, in.RoleInClass)
	return err
}
