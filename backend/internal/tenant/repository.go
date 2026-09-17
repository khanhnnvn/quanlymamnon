package tenant

import (
	"context"
	"database/sql"
	"strconv"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func scanTenant(row interface{ Scan(...any) error }) (Tenant, error) {
	var t Tenant
	err := row.Scan(&t.ID, &t.Slug, &t.Name, &t.Address, &t.Phone, &t.Email,
		&t.LogoURL, &t.Plan, &t.Status, &t.Settings, &t.CreatedAt, &t.UpdatedAt)
	return t, err
}

const tenantColumns = `id, slug, name, COALESCE(address,''), COALESCE(phone,''), COALESCE(email,''),
	COALESCE(logo_url,''), plan, status, settings::text, created_at, updated_at`

func (r *Repository) SlugExists(ctx context.Context, slug string) (bool, error) {
	var exists bool
	err := r.db.QueryRowContext(ctx, `SELECT EXISTS (SELECT 1 FROM tenants WHERE slug = $1)`, slug).Scan(&exists)
	return exists, err
}

// CreatedAdmin describes the SCHOOL_ADMIN user created together with a new
// tenant.
type CreatedAdmin struct {
	ID       string
	Email    string
	FullName string
}

// InsertWithAdmin creates the tenant and its first SCHOOL_ADMIN user
// atomically, so a tenant never ends up without an admin (or vice versa).
func (r *Repository) InsertWithAdmin(ctx context.Context, in CreateTenantInput, slug, status, adminPasswordHash string) (Tenant, CreatedAdmin, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return Tenant{}, CreatedAdmin{}, err
	}
	defer tx.Rollback() //nolint:errcheck

	row := tx.QueryRowContext(ctx, `
		INSERT INTO tenants (slug, name, address, phone, email, plan, status)
		VALUES ($1, $2, NULLIF($3,''), NULLIF($4,''), NULLIF($5,''), $6, $7)
		RETURNING `+tenantColumns,
		slug, in.Name, in.Address, in.Phone, in.Email, orDefault(in.Plan, "basic"), status,
	)
	t, err := scanTenant(row)
	if err != nil {
		return Tenant{}, CreatedAdmin{}, err
	}

	var admin CreatedAdmin
	admin.Email = in.AdminEmail
	admin.FullName = in.AdminFullName
	err = tx.QueryRowContext(ctx, `
		INSERT INTO users (tenant_id, email, password_hash, full_name, status)
		VALUES ($1, $2, $3, $4, 'active')
		RETURNING id
	`, t.ID, in.AdminEmail, adminPasswordHash, in.AdminFullName).Scan(&admin.ID)
	if err != nil {
		return Tenant{}, CreatedAdmin{}, err
	}

	var roleID string
	if err := tx.QueryRowContext(ctx, `SELECT id FROM roles WHERE code = 'SCHOOL_ADMIN'`).Scan(&roleID); err != nil {
		return Tenant{}, CreatedAdmin{}, err
	}

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3)
	`, admin.ID, roleID, t.ID); err != nil {
		return Tenant{}, CreatedAdmin{}, err
	}

	if err := tx.Commit(); err != nil {
		return Tenant{}, CreatedAdmin{}, err
	}

	return t, admin, nil
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}

func (r *Repository) List(ctx context.Context, status string, limit, offset int) ([]Tenant, int, error) {
	args := []any{}
	where := ""
	if status != "" {
		where = "WHERE status = $1"
		args = append(args, status)
	}

	var total int
	countQuery := `SELECT COUNT(*) FROM tenants ` + where
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, limit, offset)
	query := `SELECT ` + tenantColumns + ` FROM tenants ` + where +
		` ORDER BY created_at DESC LIMIT $` + strconv.Itoa(len(args)-1) + ` OFFSET $` + strconv.Itoa(len(args))

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []Tenant
	for rows.Next() {
		t, err := scanTenant(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, t)
	}
	return out, total, rows.Err()
}

func (r *Repository) GetByID(ctx context.Context, id string) (Tenant, error) {
	row := r.db.QueryRowContext(ctx, `SELECT `+tenantColumns+` FROM tenants WHERE id = $1`, id)
	return scanTenant(row)
}

// SuperAdminAuthRow is the subset of a users row needed for login.
type SuperAdminAuthRow struct {
	ID               string
	PasswordHash     string
	FullName         string
	Status           string
	FailedLoginCount int
	LockedUntil      sql.NullTime
}

// FindSuperAdminByEmail looks up a tenant_id IS NULL user by email.
func (r *Repository) FindSuperAdminByEmail(ctx context.Context, email string) (SuperAdminAuthRow, error) {
	var row SuperAdminAuthRow
	err := r.db.QueryRowContext(ctx, `
		SELECT id, password_hash, full_name, status, failed_login_count, locked_until
		FROM users WHERE tenant_id IS NULL AND email = $1
	`, email).Scan(&row.ID, &row.PasswordHash, &row.FullName, &row.Status, &row.FailedLoginCount, &row.LockedUntil)
	return row, err
}

// RolesForUser returns the role codes held by userID (works for both
// tenant-scoped and system/super-admin users).
func (r *Repository) RolesForUser(ctx context.Context, userID string) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT roles.code FROM user_roles
		JOIN roles ON roles.id = user_roles.role_id
		WHERE user_roles.user_id = $1
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var codes []string
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err != nil {
			return nil, err
		}
		codes = append(codes, code)
	}
	return codes, rows.Err()
}

// RegisterFailedLogin increments failed_login_count and, once it reaches 5,
// locks the account for 15 minutes (brute-force protection per SRS.md M2).
func (r *Repository) RegisterFailedLogin(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE users SET
			failed_login_count = failed_login_count + 1,
			locked_until = CASE WHEN failed_login_count + 1 >= 5 THEN now() + interval '15 minutes' ELSE locked_until END,
			updated_at = now()
		WHERE id = $1
	`, userID)
	return err
}

// ResetFailedLogin clears the failed-login counter after a successful login.
func (r *Repository) ResetFailedLogin(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = now() WHERE id = $1
	`, userID)
	return err
}

// SetRefreshTokenHash stores the hash of the currently valid refresh token.
func (r *Repository) SetRefreshTokenHash(ctx context.Context, userID, hash string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET refresh_token_hash = $2, updated_at = now() WHERE id = $1`, userID, hash)
	return err
}

func (r *Repository) Update(ctx context.Context, id string, in UpdateTenantInput) (Tenant, error) {
	row := r.db.QueryRowContext(ctx, `
		UPDATE tenants SET
			name = COALESCE($2, name),
			address = COALESCE($3, address),
			phone = COALESCE($4, phone),
			email = COALESCE($5, email),
			logo_url = COALESCE($6, logo_url),
			plan = COALESCE($7, plan),
			status = COALESCE($8, status),
			updated_at = now()
		WHERE id = $1
		RETURNING `+tenantColumns,
		id, in.Name, in.Address, in.Phone, in.Email, in.LogoURL, in.Plan, in.Status,
	)
	return scanTenant(row)
}
