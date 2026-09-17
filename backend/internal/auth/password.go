// Package auth provides password hashing and JWT issuance/parsing shared by
// every login flow (system super admin login and per-tenant login).
package auth

import "golang.org/x/crypto/bcrypt"

// bcryptCost is fixed at 12 per the security requirements in
// docs/ARCHITECTURE.md section 6.
const bcryptCost = 12

// HashPassword bcrypt-hashes a plaintext password.
func HashPassword(plain string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(plain), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

// CheckPassword reports whether plain matches the given bcrypt hash.
func CheckPassword(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}
