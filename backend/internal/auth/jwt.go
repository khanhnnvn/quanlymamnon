package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// AccessTokenTTL / RefreshTokenTTL match docs/ARCHITECTURE.md section 6.
const (
	AccessTokenTTL  = 30 * time.Minute
	RefreshTokenTTL = 14 * 24 * time.Hour
)

// TokenType distinguishes access from refresh tokens so one can never be
// used in place of the other.
type TokenType string

const (
	TokenTypeAccess  TokenType = "access"
	TokenTypeRefresh TokenType = "refresh"
)

// Claims is the JWT payload. TenantID is empty for the Super Admin (no
// tenant). Roles carries the role codes (a user may hold more than one).
type Claims struct {
	UserID   string    `json:"sub"`
	TenantID string    `json:"tenant_id"`
	Roles    []string  `json:"roles"`
	Type     TokenType `json:"type"`
	jwt.RegisteredClaims
}

var (
	ErrInvalidToken = errors.New("invalid token")
	ErrWrongType    = errors.New("wrong token type")
)

// IssueAccessToken creates a short-lived access token.
func IssueAccessToken(secret, userID, tenantID string, roles []string) (string, error) {
	return issue(secret, userID, tenantID, roles, TokenTypeAccess, AccessTokenTTL)
}

// IssueRefreshToken creates a long-lived refresh token.
func IssueRefreshToken(secret, userID, tenantID string, roles []string) (string, error) {
	return issue(secret, userID, tenantID, roles, TokenTypeRefresh, RefreshTokenTTL)
}

func issue(secret, userID, tenantID string, roles []string, typ TokenType, ttl time.Duration) (string, error) {
	now := time.Now()
	claims := Claims{
		UserID:   userID,
		TenantID: tenantID,
		Roles:    roles,
		Type:     typ,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

// Parse validates the token signature/expiry and, if wantType is non-empty,
// enforces the token's `type` claim.
func Parse(secret, tokenStr string, wantType TokenType) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, ErrInvalidToken
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return nil, ErrInvalidToken
	}
	if wantType != "" && claims.Type != wantType {
		return nil, ErrWrongType
	}
	return claims, nil
}

// HashToken returns a stable, non-reversible hash of a token string, used to
// store refresh tokens in users.refresh_token_hash without keeping the raw
// token at rest.
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
