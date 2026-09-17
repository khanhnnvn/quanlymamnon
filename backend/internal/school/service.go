package school

import (
	"context"
	"database/sql"
	"errors"

	"mamnon/backend/internal/scope"
)

var ErrClassNotFound = errors.New("class not found")

type Service struct {
	repo *Repository
	db   *sql.DB
}

func NewService(repo *Repository, db *sql.DB) *Service {
	return &Service{repo: repo, db: db}
}

func (s *Service) CreateSchoolYear(ctx context.Context, tenantID string, in CreateSchoolYearInput) (SchoolYear, error) {
	return s.repo.InsertSchoolYear(ctx, tenantID, in)
}

func (s *Service) ListSchoolYears(ctx context.Context, tenantID string, limit, offset int) ([]SchoolYear, int, error) {
	return s.repo.ListSchoolYears(ctx, tenantID, limit, offset)
}

func (s *Service) UpdateSchoolYear(ctx context.Context, tenantID, id string, in UpdateSchoolYearInput) (SchoolYear, error) {
	return s.repo.UpdateSchoolYear(ctx, tenantID, id, in)
}

func (s *Service) CreateGrade(ctx context.Context, tenantID string, in CreateGradeInput) (Grade, error) {
	return s.repo.InsertGrade(ctx, tenantID, in)
}

func (s *Service) ListGrades(ctx context.Context, tenantID string, limit, offset int) ([]Grade, int, error) {
	return s.repo.ListGrades(ctx, tenantID, limit, offset)
}

func (s *Service) CreateClass(ctx context.Context, tenantID string, in CreateClassInput) (Class, error) {
	return s.repo.InsertClass(ctx, tenantID, in)
}

// ListClasses applies "lớp mình" scoping: TEACHER/ASSISTANT_TEACHER only see
// classes they are assigned to; every other allowed role sees all classes
// in the tenant (docs/ARCHITECTURE.md section 5.2, no per-grade assignment
// table exists yet for HEAD_TEACHER scoping — see README caveat).
func (s *Service) ListClasses(ctx context.Context, tenantID, userID string, roles []string, limit, offset int) ([]Class, int, error) {
	if onlyTeacherRoles(roles) {
		classIDs, err := scope.TeacherClassIDs(ctx, s.db, tenantID, userID)
		if err != nil {
			return nil, 0, err
		}
		if classIDs == nil {
			classIDs = []string{}
		}
		return s.repo.ListClasses(ctx, tenantID, classIDs, limit, offset)
	}
	return s.repo.ListClasses(ctx, tenantID, nil, limit, offset)
}

func onlyTeacherRoles(roles []string) bool {
	hasAdminLevel := false
	for _, r := range roles {
		if r == "SCHOOL_ADMIN" || r == "VICE_ADMIN" || r == "HEAD_TEACHER" {
			hasAdminLevel = true
		}
	}
	return !hasAdminLevel
}

// UpdateClass returns ErrClassNotFound if no class matches id.
func (s *Service) UpdateClass(ctx context.Context, tenantID, id string, in UpdateClassInput) (Class, error) {
	cl, err := s.repo.UpdateClass(ctx, tenantID, id, in)
	if errors.Is(err, sql.ErrNoRows) {
		return Class{}, ErrClassNotFound
	}
	if err != nil {
		return Class{}, err
	}
	teachers, err := s.repo.TeachersForClass(ctx, tenantID, id)
	if err != nil {
		return Class{}, err
	}
	cl.Teachers = teachers
	return cl, nil
}

func (s *Service) AssignTeacher(ctx context.Context, tenantID, classID string, in AssignTeacherInput) (Class, error) {
	exists, err := s.repo.ClassExists(ctx, tenantID, classID)
	if err != nil {
		return Class{}, err
	}
	if !exists {
		return Class{}, ErrClassNotFound
	}

	if err := s.repo.AssignTeacher(ctx, tenantID, classID, in); err != nil {
		return Class{}, err
	}

	cl, err := s.repo.GetClassByID(ctx, tenantID, classID)
	if err != nil {
		return Class{}, err
	}
	teachers, err := s.repo.TeachersForClass(ctx, tenantID, classID)
	if err != nil {
		return Class{}, err
	}
	cl.Teachers = teachers
	return cl, nil
}
