package dashboard

import (
	"context"

	"mamnon/backend/internal/middleware"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// Summary dispatches to the right shape of data based on the actor's roles.
func (s *Service) Summary(ctx context.Context, tenantID, userID string, roles []string) (any, error) {
	switch {
	case middleware.HasAnyRole(roles, "SCHOOL_ADMIN", "VICE_ADMIN"):
		return s.repo.AdminSummary(ctx, tenantID)
	case middleware.HasAnyRole(roles, "TEACHER", "ASSISTANT_TEACHER"):
		return s.repo.TeacherSummary(ctx, tenantID, userID)
	case middleware.HasAnyRole(roles, "PARENT"):
		return s.repo.ParentSummary(ctx, tenantID, userID)
	default:
		name, err := s.repo.TenantName(ctx, tenantID)
		if err != nil {
			return nil, err
		}
		return GenericSummary{
			TenantName: name,
			Roles:      roles,
			Message:    "Chức năng báo cáo chi tiết cho vai trò này sẽ có ở giai đoạn tiếp theo",
		}, nil
	}
}
