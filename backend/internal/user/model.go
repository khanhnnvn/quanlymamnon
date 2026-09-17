// Package user implements the tenant-scoped auth endpoints
// (/{slug}/auth/login|me|refresh) and user management
// (/{slug}/users) from docs/ARCHITECTURE.md section 5.2.
package user

import "time"

// User mirrors the users table for a tenant-scoped account.
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Phone     string    `json:"phone,omitempty"`
	FullName  string    `json:"full_name"`
	AvatarURL string    `json:"avatar_url,omitempty"`
	Status    string    `json:"status"`
	Roles     []string  `json:"roles"`
	CreatedAt time.Time `json:"created_at"`
}

// LoginInput is POST /{slug}/auth/login.
type LoginInput struct {
	Email    string `json:"email" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// RefreshInput is POST /{slug}/auth/refresh.
type RefreshInput struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// CreateUserInput is POST /{slug}/users.
type CreateUserInput struct {
	Email     string   `json:"email" binding:"required,email"`
	Phone     string   `json:"phone"`
	Password  string   `json:"password" binding:"required,min=8"`
	FullName  string   `json:"full_name" binding:"required"`
	RoleCodes []string `json:"role_codes" binding:"required,min=1"`
}
