package journal

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

// Create enforces "lớp mình": only a TEACHER/ASSISTANT_TEACHER assigned to
// the class may post a journal entry for it.
func (s *Service) Create(ctx context.Context, tenantID, actorID string, roles []string, in CreateJournalInput) (Journal, error) {
	if !middleware.HasAnyRole(roles, "TEACHER", "ASSISTANT_TEACHER") {
		return Journal{}, ErrForbidden
	}
	ok, err := scope.IsTeacherOfClass(ctx, s.db, tenantID, actorID, in.ClassID)
	if err != nil {
		return Journal{}, err
	}
	if !ok {
		return Journal{}, ErrForbidden
	}
	return s.repo.Insert(ctx, tenantID, actorID, in)
}

func (s *Service) ListByClass(ctx context.Context, tenantID, actorID string, roles []string, classID, date string, limit, offset int) ([]Journal, int, error) {
	if middleware.HasAnyRole(roles, "SCHOOL_ADMIN", "VICE_ADMIN") {
		return s.repo.ListByClass(ctx, tenantID, classID, date, limit, offset)
	}
	if !middleware.HasAnyRole(roles, "TEACHER", "ASSISTANT_TEACHER") {
		return nil, 0, ErrForbidden
	}
	ok, err := scope.IsTeacherOfClass(ctx, s.db, tenantID, actorID, classID)
	if err != nil {
		return nil, 0, err
	}
	if !ok {
		return nil, 0, ErrForbidden
	}
	return s.repo.ListByClass(ctx, tenantID, classID, date, limit, offset)
}

// ListByStudent enforces: Parent (con mình) + GV liên quan (teacher/
// assistant assigned to the student's current class) + School/Vice Admin
// (giám sát toàn trường).
func (s *Service) ListByStudent(ctx context.Context, tenantID, actorID string, roles []string, studentID string, limit, offset int) ([]Journal, int, error) {
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
