// Package scope holds small cross-domain authorization lookups (e.g. "is
// this teacher assigned to this class", "is this user a parent of this
// student") that several domain packages need for the "lớp mình" / "con
// mình" (own class / own child) rules in docs/ARCHITECTURE.md section 5.2
// and the SRS.md section 4 role matrix.
package scope

import (
	"context"
	"database/sql"
)

// IsTeacherOfClass reports whether userID is assigned (main or assistant)
// to classID within tenantID.
func IsTeacherOfClass(ctx context.Context, conn *sql.DB, tenantID, userID, classID string) (bool, error) {
	var exists bool
	err := conn.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM class_teachers
			WHERE tenant_id = $1 AND user_id = $2 AND class_id = $3
		)
	`, tenantID, userID, classID).Scan(&exists)
	return exists, err
}

// TeacherClassIDs returns every class id userID is assigned to within
// tenantID.
func TeacherClassIDs(ctx context.Context, conn *sql.DB, tenantID, userID string) ([]string, error) {
	rows, err := conn.QueryContext(ctx, `
		SELECT class_id FROM class_teachers WHERE tenant_id = $1 AND user_id = $2
	`, tenantID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// IsParentOfStudent reports whether userID is a linked parent/guardian of
// studentID within tenantID.
func IsParentOfStudent(ctx context.Context, conn *sql.DB, tenantID, userID, studentID string) (bool, error) {
	var exists bool
	err := conn.QueryRowContext(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM student_parents
			WHERE tenant_id = $1 AND parent_user_id = $2 AND student_id = $3
		)
	`, tenantID, userID, studentID).Scan(&exists)
	return exists, err
}

// ParentClassAndGradeIDs returns the distinct current_class_id and grade_id
// values across every child linked to parentUserID within tenantID — used
// by announcements so a parent sees school-wide plus their children's
// grade/class-targeted announcements (SRS.md section 4: "Phụ huynh — Nhận").
func ParentClassAndGradeIDs(ctx context.Context, conn *sql.DB, tenantID, parentUserID string) (classIDs, gradeIDs []string, err error) {
	rows, err := conn.QueryContext(ctx, `
		SELECT DISTINCT s.current_class_id, c.grade_id
		FROM student_parents sp
		JOIN students s ON s.id = sp.student_id AND s.tenant_id = sp.tenant_id
		LEFT JOIN classes c ON c.id = s.current_class_id
		WHERE sp.tenant_id = $1 AND sp.parent_user_id = $2
	`, tenantID, parentUserID)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var classID, gradeID sql.NullString
		if err := rows.Scan(&classID, &gradeID); err != nil {
			return nil, nil, err
		}
		if classID.Valid && classID.String != "" {
			classIDs = append(classIDs, classID.String)
		}
		if gradeID.Valid && gradeID.String != "" {
			gradeIDs = append(gradeIDs, gradeID.String)
		}
	}
	return classIDs, gradeIDs, rows.Err()
}

// StudentClassID returns the current_class_id of a student (may be "" if
// NULL), or sql.ErrNoRows if the student does not exist in the tenant.
func StudentClassID(ctx context.Context, conn *sql.DB, tenantID, studentID string) (string, error) {
	var classID sql.NullString
	err := conn.QueryRowContext(ctx, `
		SELECT current_class_id FROM students
		WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, tenantID, studentID).Scan(&classID)
	if err != nil {
		return "", err
	}
	return classID.String, nil
}
