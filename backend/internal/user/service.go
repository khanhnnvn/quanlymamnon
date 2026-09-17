package user

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"mamnon/backend/internal/auth"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrAccountLocked      = errors.New("account locked")
	ErrAccountDisabled    = errors.New("account disabled")
	ErrInvalidRefresh     = errors.New("invalid refresh token")
	ErrRoleNotFound       = errors.New("one or more role codes do not exist")
)

type Service struct {
	repo      *Repository
	jwtSecret string
}

func NewService(repo *Repository, jwtSecret string) *Service {
	return &Service{repo: repo, jwtSecret: jwtSecret}
}

type TokenPair struct {
	AccessToken  string
	RefreshToken string
	UserID       string
	FullName     string
	Roles        []string
}

func (s *Service) Login(ctx context.Context, tenantID string, in LoginInput) (TokenPair, error) {
	row, err := s.repo.FindByEmail(ctx, tenantID, in.Email)
	if errors.Is(err, sql.ErrNoRows) {
		return TokenPair{}, ErrInvalidCredentials
	}
	if err != nil {
		return TokenPair{}, err
	}

	if row.Status != "active" {
		return TokenPair{}, ErrAccountDisabled
	}
	if row.LockedUntil.Valid && row.LockedUntil.Time.After(time.Now()) {
		return TokenPair{}, ErrAccountLocked
	}

	if !auth.CheckPassword(row.PasswordHash, in.Password) {
		_ = s.repo.RegisterFailedLogin(ctx, row.ID)
		return TokenPair{}, ErrInvalidCredentials
	}
	_ = s.repo.ResetFailedLogin(ctx, row.ID)

	roles, err := s.repo.RolesForUser(ctx, row.ID)
	if err != nil {
		return TokenPair{}, err
	}

	return s.issueTokens(ctx, tenantID, row.ID, row.FullName, roles)
}

func (s *Service) issueTokens(ctx context.Context, tenantID, userID, fullName string, roles []string) (TokenPair, error) {
	access, err := auth.IssueAccessToken(s.jwtSecret, userID, tenantID, roles)
	if err != nil {
		return TokenPair{}, err
	}
	refresh, err := auth.IssueRefreshToken(s.jwtSecret, userID, tenantID, roles)
	if err != nil {
		return TokenPair{}, err
	}
	if err := s.repo.SetRefreshTokenHash(ctx, userID, auth.HashToken(refresh)); err != nil {
		return TokenPair{}, err
	}
	return TokenPair{AccessToken: access, RefreshToken: refresh, UserID: userID, FullName: fullName, Roles: roles}, nil
}

// Refresh validates the refresh token (signature, expiry, type, tenant
// match, and that it is still the current stored token) and rotates it.
func (s *Service) Refresh(ctx context.Context, tenantID string, in RefreshInput) (TokenPair, error) {
	claims, err := auth.Parse(s.jwtSecret, in.RefreshToken, auth.TokenTypeRefresh)
	if err != nil {
		return TokenPair{}, ErrInvalidRefresh
	}
	if claims.TenantID != tenantID {
		return TokenPair{}, ErrInvalidRefresh
	}

	row, err := s.repo.FindByID(ctx, tenantID, claims.UserID)
	if errors.Is(err, sql.ErrNoRows) {
		return TokenPair{}, ErrInvalidRefresh
	}
	if err != nil {
		return TokenPair{}, err
	}
	if row.Status != "active" {
		return TokenPair{}, ErrAccountDisabled
	}
	if !row.RefreshHash.Valid || row.RefreshHash.String != auth.HashToken(in.RefreshToken) {
		return TokenPair{}, ErrInvalidRefresh
	}

	roles, err := s.repo.RolesForUser(ctx, row.ID)
	if err != nil {
		return TokenPair{}, err
	}

	return s.issueTokens(ctx, tenantID, row.ID, row.FullName, roles)
}

// Me returns the profile + roles for an already-authenticated user.
func (s *Service) Me(ctx context.Context, tenantID, userID string) (User, error) {
	row, err := s.repo.FindByID(ctx, tenantID, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return User{}, ErrInvalidCredentials
	}
	if err != nil {
		return User{}, err
	}
	roles, err := s.repo.RolesForUser(ctx, userID)
	if err != nil {
		return User{}, err
	}
	return User{
		ID:        row.ID,
		Email:     row.Email,
		Phone:     row.Phone,
		FullName:  row.FullName,
		AvatarURL: row.AvatarURL,
		Status:    row.Status,
		Roles:     roles,
	}, nil
}

func (s *Service) CreateUser(ctx context.Context, tenantID string, in CreateUserInput) (User, error) {
	hash, err := auth.HashPassword(in.Password)
	if err != nil {
		return User{}, err
	}
	u, err := s.repo.Insert(ctx, tenantID, in, hash)
	if err != nil {
		return User{}, err
	}
	if len(u.Roles) != len(in.RoleCodes) {
		return User{}, ErrRoleNotFound
	}
	return u, nil
}

func (s *Service) ListUsers(ctx context.Context, tenantID string, limit, offset int) ([]User, int, error) {
	return s.repo.List(ctx, tenantID, limit, offset)
}
