package attendance

import (
	"context"
	"database/sql"
	"errors"

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

// Record enforces that TEACHER/ASSISTANT_TEACHER may only record attendance
// for a class they are assigned to.
func (s *Service) Record(ctx context.Context, tenantID, actorID string, roles []string, in RecordInput) (Attendance, error) {
	if !middleware.HasAnyRole(roles, "TEACHER", "ASSISTANT_TEACHER") {
		return Attendance{}, ErrForbidden
	}
	ok, err := scope.IsTeacherOfClass(ctx, s.db, tenantID, actorID, in.ClassID)
	if err != nil {
		return Attendance{}, err
	}
	if !ok {
		return Attendance{}, ErrForbidden
	}
	return s.repo.Upsert(ctx, tenantID, actorID, in)
}

// ListByClass enforces: Teacher/Assistant (lớp mình) or School/Vice Admin
// (xem tất cả).
func (s *Service) ListByClass(ctx context.Context, tenantID, actorID string, roles []string, classID, date string, limit, offset int) ([]Attendance, int, error) {
	if middleware.HasAnyRole(roles, "SCHOOL_ADMIN", "VICE_ADMIN") {
		return s.repo.ListByClassDate(ctx, tenantID, classID, date, limit, offset)
	}
	if middleware.HasAnyRole(roles, "TEACHER", "ASSISTANT_TEACHER") {
		ok, err := scope.IsTeacherOfClass(ctx, s.db, tenantID, actorID, classID)
		if err != nil {
			return nil, 0, err
		}
		if !ok {
			return nil, 0, ErrForbidden
		}
		return s.repo.ListByClassDate(ctx, tenantID, classID, date, limit, offset)
	}
	return nil, 0, ErrForbidden
}

// ListByStudent enforces: Teacher/Assistant liên quan (assigned to the
// student's current class), Parent (con mình), or School/Vice Admin.
func (s *Service) ListByStudent(ctx context.Context, tenantID, actorID string, roles []string, studentID string, limit, offset int) ([]Attendance, int, error) {
	if middleware.HasAnyRole(roles, "SCHOOL_ADMIN", "VICE_ADMIN") {
		return s.repo.ListByStudent(ctx, tenantID, studentID, limit, offset)
	}
	if middleware.HasAnyRole(roles, "PARENT") {
		ok, err := scope.IsParentOfStudent(ctx, s.db, tenantID, actorID, studentID)
		if err != nil {
			return nil, 0, err
		}
		if ok {
			return s.repo.ListByStudent(ctx, tenantID, studentID, limit, offset)
		}
	}
	if middleware.HasAnyRole(roles, "TEACHER", "ASSISTANT_TEACHER") {
		classID, err := scope.StudentClassID(ctx, s.db, tenantID, studentID)
		if err != nil {
			return nil, 0, err
		}
		if classID != "" {
			ok, err := scope.IsTeacherOfClass(ctx, s.db, tenantID, actorID, classID)
			if err != nil {
				return nil, 0, err
			}
			if ok {
				return s.repo.ListByStudent(ctx, tenantID, studentID, limit, offset)
			}
		}
	}
	return nil, 0, ErrForbidden
}
