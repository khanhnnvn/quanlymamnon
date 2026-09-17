package announcement

import (
	"context"
	"database/sql"
	"errors"
	"strconv"
	"strings"

	"mamnon/backend/internal/middleware"
	"mamnon/backend/internal/scope"
)

var ErrForbidden = errors.New("forbidden")

type Service struct {
	repo *Repository
	db   *sql.DB
}

func NewService(repo *Repository, db *sql.DB) *Service {
	return &Service{repo: repo, db: db}
}

// Create enforces: Admin/Vice may target the whole school or a grade;
// Teacher may only target their own class ("lớp mình").
func (s *Service) Create(ctx context.Context, tenantID, actorID string, roles []string, in CreateAnnouncementInput) (Announcement, error) {
	isAdmin := middleware.HasAnyRole(roles, "SCHOOL_ADMIN", "VICE_ADMIN")
	isTeacher := middleware.HasAnyRole(roles, "TEACHER")

	switch {
	case isAdmin:
		// allowed for any audience
	case isTeacher:
		if in.Audience != "class" || in.ClassID == "" {
			return Announcement{}, ErrForbidden
		}
		ok, err := scope.IsTeacherOfClass(ctx, s.db, tenantID, actorID, in.ClassID)
		if err != nil {
			return Announcement{}, err
		}
		if !ok {
			return Announcement{}, ErrForbidden
		}
	default:
		return Announcement{}, ErrForbidden
	}

	return s.repo.Insert(ctx, tenantID, actorID, in)
}

func (s *Service) List(ctx context.Context, tenantID, actorID string, roles []string, limit, offset int) ([]Announcement, int, error) {
	if middleware.HasAnyRole(roles, "SCHOOL_ADMIN", "VICE_ADMIN") {
		return s.repo.ListAll(ctx, tenantID, limit, offset)
	}
	if middleware.HasAnyRole(roles, "TEACHER", "ASSISTANT_TEACHER") {
		classIDs, err := scope.TeacherClassIDs(ctx, s.db, tenantID, actorID)
		if err != nil {
			return nil, 0, err
		}
		gradeIDs, err := s.gradeIDsForClasses(ctx, classIDs)
		if err != nil {
			return nil, 0, err
		}
		return s.repo.ListForTeacher(ctx, tenantID, gradeIDs, classIDs, limit, offset)
	}
	if middleware.HasAnyRole(roles, "PARENT") {
		classIDs, gradeIDs, err := scope.ParentClassAndGradeIDs(ctx, s.db, tenantID, actorID)
		if err != nil {
			return nil, 0, err
		}
		return s.repo.ListForTeacher(ctx, tenantID, gradeIDs, classIDs, limit, offset)
	}
	return nil, 0, ErrForbidden
}

func (s *Service) gradeIDsForClasses(ctx context.Context, classIDs []string) ([]string, error) {
	if len(classIDs) == 0 {
		return nil, nil
	}
	placeholders := make([]string, len(classIDs))
	args := make([]any, len(classIDs))
	for i, id := range classIDs {
		placeholders[i] = "$" + strconv.Itoa(i+1)
		args[i] = id
	}
	rows, err := s.db.QueryContext(ctx,
		`SELECT DISTINCT grade_id FROM classes WHERE id IN (`+strings.Join(placeholders, ",")+`)`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []string
	for rows.Next() {
		var g string
		if err := rows.Scan(&g); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}
