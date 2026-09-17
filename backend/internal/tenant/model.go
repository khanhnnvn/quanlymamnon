// Package tenant implements the Super Admin "system" endpoints of
// docs/ARCHITECTURE.md section 5.1: super admin login plus tenant
// (school) management.
package tenant

import "time"

// Tenant mirrors the tenants table (docs/ARCHITECTURE.md section 4.1).
type Tenant struct {
	ID        string    `json:"id"`
	Slug      string    `json:"slug"`
	Name      string    `json:"name"`
	Address   string    `json:"address,omitempty"`
	Phone     string    `json:"phone,omitempty"`
	Email     string    `json:"email,omitempty"`
	LogoURL   string    `json:"logo_url,omitempty"`
	Plan      string    `json:"plan"`
	Status    string    `json:"status"`
	Settings  string    `json:"settings"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateTenantInput is the POST /system/tenants request body.
type CreateTenantInput struct {
	Name          string `json:"name" binding:"required"`
	Slug          string `json:"slug"`
	Address       string `json:"address"`
	Phone         string `json:"phone"`
	Email         string `json:"email"`
	Plan          string `json:"plan"`
	AdminFullName string `json:"admin_full_name" binding:"required"`
	AdminEmail    string `json:"admin_email" binding:"required,email"`
	AdminPassword string `json:"admin_password"`
}

// UpdateTenantInput is the PATCH /system/tenants/:id request body. Pointer
// fields distinguish "not provided" from "set to empty".
type UpdateTenantInput struct {
	Name    *string `json:"name"`
	Address *string `json:"address"`
	Phone   *string `json:"phone"`
	Email   *string `json:"email"`
	LogoURL *string `json:"logo_url"`
	Plan    *string `json:"plan"`
	Status  *string `json:"status"`
}

// LoginInput is the POST /system/auth/login request body.
type LoginInput struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}
