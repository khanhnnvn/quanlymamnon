package user

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// AuthRow is the subset of a users row needed for login/refresh checks and
// for the GET /auth/me profile response.
type AuthRow struct {
	ID               string
	Email            string
	Phone            string
	PasswordHash     string
	FullName         string
	AvatarURL        string
	Status           string
	FailedLoginCount int
	LockedUntil      sql.NullTime
	RefreshHash      sql.NullString
}

func (r *Repository) FindByEmail(ctx context.Context, tenantID, email string) (AuthRow, error) {
	var row AuthRow
	err := r.db.QueryRowContext(ctx, `
		SELECT id, email, COALESCE(phone,''), password_hash, full_name, COALESCE(avatar_url,''), status,
			failed_login_count, locked_until, refresh_token_hash
		FROM users WHERE tenant_id = $1 AND email = $2
	`, tenantID, email).Scan(&row.ID, &row.Email, &row.Phone, &row.PasswordHash, &row.FullName, &row.AvatarURL, &row.Status,
		&row.FailedLoginCount, &row.LockedUntil, &row.RefreshHash)
	return row, err
}

func (r *Repository) FindByID(ctx context.Context, tenantID, userID string) (AuthRow, error) {
	var row AuthRow
	err := r.db.QueryRowContext(ctx, `
		SELECT id, email, COALESCE(phone,''), password_hash, full_name, COALESCE(avatar_url,''), status,
			failed_login_count, locked_until, refresh_token_hash
		FROM users WHERE tenant_id = $1 AND id = $2
	`, tenantID, userID).Scan(&row.ID, &row.Email, &row.Phone, &row.PasswordHash, &row.FullName, &row.AvatarURL, &row.Status,
		&row.FailedLoginCount, &row.LockedUntil, &row.RefreshHash)
	return row, err
}

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

func (r *Repository) ResetFailedLogin(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = now() WHERE id = $1
	`, userID)
	return err
}

func (r *Repository) SetRefreshTokenHash(ctx context.Context, userID, hash string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET refresh_token_hash = $2, updated_at = now() WHERE id = $1`, userID, hash)
	return err
}

// Insert creates a tenant user and assigns the given role codes in one
// transaction.
func (r *Repository) Insert(ctx context.Context, tenantID string, in CreateUserInput, passwordHash string) (User, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return User{}, err
	}
	defer tx.Rollback() //nolint:errcheck

	var u User
	err = tx.QueryRowContext(ctx, `
		INSERT INTO users (tenant_id, email, phone, password_hash, full_name, status)
		VALUES ($1, $2, NULLIF($3,''), $4, $5, 'active')
		RETURNING id, email, COALESCE(phone,''), full_name, COALESCE(avatar_url,''), status, created_at
	`, tenantID, in.Email, in.Phone, passwordHash, in.FullName).
		Scan(&u.ID, &u.Email, &u.Phone, &u.FullName, &u.AvatarURL, &u.Status, &u.CreatedAt)
	if err != nil {
		return User{}, err
	}

	placeholders := make([]string, len(in.RoleCodes))
	args := make([]any, len(in.RoleCodes))
	for i, code := range in.RoleCodes {
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = code
	}
	roleRows, err := tx.QueryContext(ctx,
		`SELECT id, code FROM roles WHERE code IN (`+strings.Join(placeholders, ",")+`)`, args...)
	if err != nil {
		return User{}, err
	}
	roleIDs := make([]string, 0, len(in.RoleCodes))
	for roleRows.Next() {
		var id, code string
		if err := roleRows.Scan(&id, &code); err != nil {
			roleRows.Close()
			return User{}, err
		}
		roleIDs = append(roleIDs, id)
		u.Roles = append(u.Roles, code)
	}
	roleRows.Close()

	for _, roleID := range roleIDs {
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3)
		`, u.ID, roleID, tenantID); err != nil {
			return User{}, err
		}
	}

	if err := tx.Commit(); err != nil {
		return User{}, err
	}
	return u, nil
}

func (r *Repository) List(ctx context.Context, tenantID string, limit, offset int) ([]User, int, error) {
	var total int
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE tenant_id = $1`, tenantID).Scan(&total); err != nil {
		return nil, 0, err
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, email, COALESCE(phone,''), full_name, COALESCE(avatar_url,''), status, created_at
		FROM users WHERE tenant_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, tenantID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Phone, &u.FullName, &u.AvatarURL, &u.Status, &u.CreatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, u)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	for i := range out {
		roles, err := r.RolesForUser(ctx, out[i].ID)
		if err != nil {
			return nil, 0, err
		}
		out[i].Roles = roles
	}

	return out, total, nil
}
