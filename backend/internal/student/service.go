package student

import (
	"context"
	"database/sql"
	"errors"

	"mamnon/backend/internal/middleware"
	"mamnon/backend/internal/scope"
)

var (
	ErrForbidden = errors.New("forbidden")
	ErrNotFound  = errors.New("not found")
)

type Service struct {
	repo *Repository
	db   *sql.DB
}

func NewService(repo *Repository, db *sql.DB) *Service {
	return &Service{repo: repo, db: db}
}

// CreateStudent enforces "lớp mình": a TEACHER may only create a student
// already assigned into one of their own classes.
func (s *Service) CreateStudent(ctx context.Context, tenantID, actorID string, roles []string, in CreateStudentInput) (Student, error) {
	if middleware.HasAnyRole(roles, "TEACHER") && !middleware.HasAnyRole(roles, "SCHOOL_ADMIN", "VICE_ADMIN") {
		if in.CurrentClassID == "" {
			return Student{}, ErrForbidden
		}
		ok, err := scope.IsTeacherOfClass(ctx, s.db, tenantID, actorID, in.CurrentClassID)
		if err != nil {
			return Student{}, err
		}
		if !ok {
			return Student{}, ErrForbidden
		}
	}
	return s.repo.Insert(ctx, tenantID, in)
}

// ListStudents scopes the result set to the teacher's own classes when the
// actor only holds TEACHER (not an admin-level role).
func (s *Service) ListStudents(ctx context.Context, tenantID, actorID string, roles []string, classFilter string, limit, offset int) ([]Student, int, error) {
	if middleware.HasAnyRole(roles, "TEACHER") && !middleware.HasAnyRole(roles, "SCHOOL_ADMIN", "VICE_ADMIN") {
		classIDs, err := scope.TeacherClassIDs(ctx, s.db, tenantID, actorID)
		if err != nil {
			return nil, 0, err
		}
		if len(classIDs) == 0 {
			return []Student{}, 0, nil
		}
		if classFilter != "" {
			if !containsString(classIDs, classFilter) {
				return []Student{}, 0, nil
			}
			return s.repo.List(ctx, tenantID, classFilter, limit, offset)
		}
		// A teacher with several classes: aggregate manually since the
		// repository's simple filter only takes one class id.
		var all []Student
		total := 0
		for _, cid := range classIDs {
			items, n, err := s.repo.List(ctx, tenantID, cid, limit, offset)
			if err != nil {
				return nil, 0, err
			}
			all = append(all, items...)
			total += n
		}
		return all, total, nil
	}
	return s.repo.List(ctx, tenantID, classFilter, limit, offset)
}

func containsString(ss []string, v string) bool {
	for _, s := range ss {
		if s == v {
			return true
		}
	}
	return false
}

// GetStudent enforces: Admin/Vice/Teacher(lớp mình) + Parent (con mình).
func (s *Service) GetStudent(ctx context.Context, tenantID, actorID string, roles []string, studentID string) (Student, error) {
	st, err := s.repo.GetByID(ctx, tenantID, studentID)
	if errors.Is(err, sql.ErrNoRows) {
		return Student{}, ErrNotFound
	}
	if err != nil {
		return Student{}, err
	}

	if middleware.HasAnyRole(roles, "SCHOOL_ADMIN", "VICE_ADMIN") {
		return st, nil
	}
	if middleware.HasAnyRole(roles, "TEACHER") {
		if st.CurrentClassID != "" {
			ok, err := scope.IsTeacherOfClass(ctx, s.db, tenantID, actorID, st.CurrentClassID)
			if err != nil {
				return Student{}, err
			}
			if ok {
				return st, nil
			}
		}
	}
	if middleware.HasAnyRole(roles, "PARENT") {
		ok, err := scope.IsParentOfStudent(ctx, s.db, tenantID, actorID, studentID)
		if err != nil {
			return Student{}, err
		}
		if ok {
			return st, nil
		}
	}
	return Student{}, ErrForbidden
}

// UpdateStudent enforces the same "lớp mình" rule as CreateStudent: a
// TEACHER (without an admin-level role) may only edit a student who is
// currently in one of their own classes.
func (s *Service) UpdateStudent(ctx context.Context, tenantID, actorID string, roles []string, studentID string, in UpdateStudentInput) (Student, error) {
	if middleware.HasAnyRole(roles, "TEACHER") && !middleware.HasAnyRole(roles, "SCHOOL_ADMIN", "VICE_ADMIN") {
		classID, err := scope.StudentClassID(ctx, s.db, tenantID, studentID)
		if errors.Is(err, sql.ErrNoRows) {
			return Student{}, ErrNotFound
		}
		if err != nil {
			return Student{}, err
		}
		if classID == "" {
			return Student{}, ErrForbidden
		}
		ok, err := scope.IsTeacherOfClass(ctx, s.db, tenantID, actorID, classID)
		if err != nil {
			return Student{}, err
		}
		if !ok {
			return Student{}, ErrForbidden
		}
	}

	st, err := s.repo.Update(ctx, tenantID, studentID, in)
	if errors.Is(err, sql.ErrNoRows) {
		return Student{}, ErrNotFound
	}
	return st, err
}

func (s *Service) LinkParent(ctx context.Context, tenantID, studentID string, in LinkParentInput) error {
	return s.repo.LinkParent(ctx, tenantID, studentID, in)
}
