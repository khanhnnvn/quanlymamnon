package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"

	"mamnon/backend/internal/auth"
	"mamnon/backend/internal/response"
)

// AuthRequired parses and validates the `Authorization: Bearer <token>`
// header and stores the claims in the Gin context. It does not by itself
// check that the token's tenant matches the URL — see RequireTenantMatch and
// RequireSystemAdmin, which run after this middleware.
func AuthRequired(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			response.Unauthorized(c, "Thiếu token xác thực")
			return
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")

		claims, err := auth.Parse(jwtSecret, tokenStr, auth.TokenTypeAccess)
		if err != nil {
			response.Unauthorized(c, "Token không hợp lệ hoặc đã hết hạn")
			return
		}

		c.Set(CtxUserID, claims.UserID)
		c.Set(CtxUserTenantID, claims.TenantID)
		c.Set(CtxUserRoles, claims.Roles)
		c.Next()
	}
}

// RequireTenantMatch must run after both TenantResolver and AuthRequired on
// tenant-scoped routes. It enforces claims.tenant_id == tenant_id resolved
// from the URL, per docs/ARCHITECTURE.md section 2 — the JWT's tenant claim
// is the only trusted source, never the URL alone and never the body/query.
func RequireTenantMatch() gin.HandlerFunc {
	return func(c *gin.Context) {
		urlTenantID, _ := c.Get(CtxTenantID)
		userTenantID, _ := c.Get(CtxUserTenantID)

		if userTenantID == "" || userTenantID != urlTenantID {
			response.Forbidden(c, "Không có quyền truy cập trường này")
			return
		}
		c.Next()
	}
}

// RequireSystemAdmin must run after AuthRequired on /system/* routes. It
// enforces claims.tenant_id == "" (no tenant) and claims.roles contains
// SUPER_ADMIN.
func RequireSystemAdmin() gin.HandlerFunc {
	return func(c *gin.Context) {
		userTenantID, _ := c.Get(CtxUserTenantID)
		if userTenantID != "" {
			response.Forbidden(c, "Không có quyền truy cập")
			return
		}

		roles, _ := c.Get(CtxUserRoles)
		roleList, _ := roles.([]string)
		for _, r := range roleList {
			if r == "SUPER_ADMIN" {
				c.Next()
				return
			}
		}
		response.Forbidden(c, "Không có quyền truy cập")
	}
}
