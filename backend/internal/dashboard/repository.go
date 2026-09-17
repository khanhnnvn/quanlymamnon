package dashboard

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

func (r *Repository) AdminSummary(ctx context.Context, tenantID string) (AdminSummary, error) {
	var s AdminSummary

	if err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM students WHERE tenant_id = $1 AND deleted_at IS NULL AND status = 'enrolled'
	`, tenantID).Scan(&s.TotalStudents); err != nil {
		return s, err
	}
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM classes WHERE tenant_id = $1`, tenantID).Scan(&s.TotalClasses); err != nil {
		return s, err
	}
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND status = 'active'`, tenantID).Scan(&s.TotalStaff); err != nil {
		return s, err
	}
	if err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FILTER (WHERE status = 'present'), COUNT(*) FILTER (WHERE status = 'absent')
		FROM attendance WHERE tenant_id = $1 AND date = CURRENT_DATE
	`, tenantID).Scan(&s.TodayPresentCount, &s.TodayAbsentCount); err != nil {
		return s, err
	}
	if err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM announcements WHERE tenant_id = $1 AND created_at > now() - interval '7 days'
	`, tenantID).Scan(&s.RecentAnnouncements); err != nil {
		return s, err
	}

	return s, nil
}

func (r *Repository) TeacherSummary(ctx context.Context, tenantID, userID string) (TeacherSummary, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT c.id, c.name,
			(SELECT COUNT(*) FROM students st WHERE st.current_class_id = c.id AND st.deleted_at IS NULL) AS student_count,
			(SELECT COUNT(*) FROM attendance a WHERE a.class_id = c.id AND a.date = CURRENT_DATE AND a.status = 'present') AS present_count
		FROM classes c
		JOIN class_teachers ct ON ct.class_id = c.id
		WHERE ct.tenant_id = $1 AND ct.user_id = $2
		ORDER BY c.name
	`, tenantID, userID)
	if err != nil {
		return TeacherSummary{}, err
	}
	defer rows.Close()

	summary := TeacherSummary{Classes: []TeacherClassInfo{}}
	for rows.Next() {
		var ci TeacherClassInfo
		if err := rows.Scan(&ci.ClassID, &ci.ClassName, &ci.StudentCount, &ci.TodayPresentCount); err != nil {
			return TeacherSummary{}, err
		}
		summary.Classes = append(summary.Classes, ci)
	}
	return summary, rows.Err()
}

func (r *Repository) ParentSummary(ctx context.Context, tenantID, userID string) (ParentSummary, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT st.id, st.full_name,
			COALESCE((SELECT a.status FROM attendance a WHERE a.student_id = st.id AND a.date = CURRENT_DATE), ''),
			(SELECT COUNT(*) FROM daily_journals dj WHERE dj.student_id = st.id AND dj.date > CURRENT_DATE - 7) AS recent_journals
		FROM student_parents sp
		JOIN students st ON st.id = sp.student_id
		WHERE sp.tenant_id = $1 AND sp.parent_user_id = $2 AND st.deleted_at IS NULL
		ORDER BY st.full_name
	`, tenantID, userID)
	if err != nil {
		return ParentSummary{}, err
	}
	defer rows.Close()

	summary := ParentSummary{Children: []ParentChildInfo{}}
	for rows.Next() {
		var ci ParentChildInfo
		if err := rows.Scan(&ci.StudentID, &ci.FullName, &ci.TodayAttendanceStatus, &ci.RecentJournalCount); err != nil {
			return ParentSummary{}, err
		}
		summary.Children = append(summary.Children, ci)
	}
	return summary, rows.Err()
}

func (r *Repository) TenantName(ctx context.Context, tenantID string) (string, error) {
	var name string
	err := r.db.QueryRowContext(ctx, `SELECT name FROM tenants WHERE id = $1`, tenantID).Scan(&name)
	return name, err
}
