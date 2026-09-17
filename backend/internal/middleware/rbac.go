package middleware

import (
	"github.com/gin-gonic/gin"

	"mamnon/backend/internal/response"
)

// RequireRole allows the request through only if the authenticated user
// holds at least one of the given role codes. Must run after AuthRequired.
func RequireRole(codes ...string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(codes))
	for _, c := range codes {
		allowed[c] = true
	}

	return func(c *gin.Context) {
		roles, _ := c.Get(CtxUserRoles)
		roleList, _ := roles.([]string)

		for _, r := range roleList {
			if allowed[r] {
				c.Next()
				return
			}
		}
		response.Forbidden(c, "Vai trò của bạn không có quyền thực hiện thao tác này")
	}
}

// HasRole reports whether roleList contains code.
func HasRole(roleList []string, code string) bool {
	for _, r := range roleList {
		if r == code {
			return true
		}
	}
	return false
}

// HasAnyRole reports whether roleList contains any of codes.
func HasAnyRole(roleList []string, codes ...string) bool {
	for _, code := range codes {
		if HasRole(roleList, code) {
			return true
		}
	}
	return false
}

// RolesFromContext extracts the role list stashed by AuthRequired.
func RolesFromContext(c *gin.Context) []string {
	roles, _ := c.Get(CtxUserRoles)
	roleList, _ := roles.([]string)
	return roleList
}

// UserIDFromContext extracts the authenticated user id.
func UserIDFromContext(c *gin.Context) string {
	v, _ := c.Get(CtxUserID)
	s, _ := v.(string)
	return s
}

// TenantIDFromContext extracts the URL-resolved tenant id (set by
// TenantResolver). This is the trusted tenant id for the request.
func TenantIDFromContext(c *gin.Context) string {
	v, _ := c.Get(CtxTenantID)
	s, _ := v.(string)
	return s
}
