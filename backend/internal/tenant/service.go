package tenant

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"errors"
	"time"

	"mamnon/backend/internal/auth"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrAccountLocked      = errors.New("account locked")
	ErrAccountDisabled    = errors.New("account disabled")
	ErrNotFound           = errors.New("not found")
)

type Service struct {
	repo      *Repository
	jwtSecret string
}

func NewService(repo *Repository, jwtSecret string) *Service {
	return &Service{repo: repo, jwtSecret: jwtSecret}
}

// CreateTenantResult is returned to the handler after a successful create.
type CreateTenantResult struct {
	Tenant       Tenant
	AdminID      string
	AdminEmail   string
	TempPassword string // only set when the caller did not supply admin_password
}

func (s *Service) CreateTenant(ctx context.Context, in CreateTenantInput) (CreateTenantResult, error) {
	slug, err := s.resolveSlug(ctx, in.Slug, in.Name)
	if err != nil {
		return CreateTenantResult{}, err
	}

	tempPassword := ""
	password := in.AdminPassword
	if password == "" {
		tempPassword, err = randomPassword()
		if err != nil {
			return CreateTenantResult{}, err
		}
		password = tempPassword
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return CreateTenantResult{}, err
	}

	t, admin, err := s.repo.InsertWithAdmin(ctx, in, slug, "active", hash)
	if err != nil {
		return CreateTenantResult{}, err
	}

	return CreateTenantResult{
		Tenant:       t,
		AdminID:      admin.ID,
		AdminEmail:   admin.Email,
		TempPassword: tempPassword,
	}, nil
}

func (s *Service) ListTenants(ctx context.Context, status string, limit, offset int) ([]Tenant, int, error) {
	return s.repo.List(ctx, status, limit, offset)
}

func (s *Service) GetTenant(ctx context.Context, id string) (Tenant, error) {
	t, err := s.repo.GetByID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return Tenant{}, ErrNotFound
	}
	return t, err
}

func (s *Service) UpdateTenant(ctx context.Context, id string, in UpdateTenantInput) (Tenant, error) {
	t, err := s.repo.Update(ctx, id, in)
	if errors.Is(err, sql.ErrNoRows) {
		return Tenant{}, ErrNotFound
	}
	return t, err
}

// LoginResult carries the issued tokens plus basic profile info.
type LoginResult struct {
	AccessToken  string
	RefreshToken string
	UserID       string
	FullName     string
	Roles        []string
}

// Login authenticates the Super Admin (tenant_id IS NULL, role SUPER_ADMIN).
func (s *Service) Login(ctx context.Context, in LoginInput) (LoginResult, error) {
	row, err := s.repo.FindSuperAdminByEmail(ctx, in.Email)
	if errors.Is(err, sql.ErrNoRows) {
		return LoginResult{}, ErrInvalidCredentials
	}
	if err != nil {
		return LoginResult{}, err
	}

	if row.Status != "active" {
		return LoginResult{}, ErrAccountDisabled
	}
	if row.LockedUntil.Valid && row.LockedUntil.Time.After(time.Now()) {
		return LoginResult{}, ErrAccountLocked
	}

	if !auth.CheckPassword(row.PasswordHash, in.Password) {
		_ = s.repo.RegisterFailedLogin(ctx, row.ID)
		return LoginResult{}, ErrInvalidCredentials
	}

	roles, err := s.repo.RolesForUser(ctx, row.ID)
	if err != nil {
		return LoginResult{}, err
	}
	if !containsRole(roles, "SUPER_ADMIN") {
		return LoginResult{}, ErrInvalidCredentials
	}

	_ = s.repo.ResetFailedLogin(ctx, row.ID)

	access, err := auth.IssueAccessToken(s.jwtSecret, row.ID, "", roles)
	if err != nil {
		return LoginResult{}, err
	}
	refresh, err := auth.IssueRefreshToken(s.jwtSecret, row.ID, "", roles)
	if err != nil {
		return LoginResult{}, err
	}
	if err := s.repo.SetRefreshTokenHash(ctx, row.ID, auth.HashToken(refresh)); err != nil {
		return LoginResult{}, err
	}

	return LoginResult{
		AccessToken:  access,
		RefreshToken: refresh,
		UserID:       row.ID,
		FullName:     row.FullName,
		Roles:        roles,
	}, nil
}

func containsRole(roles []string, code string) bool {
	for _, r := range roles {
		if r == code {
			return true
		}
	}
	return false
}

func randomPassword() (string, error) {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
