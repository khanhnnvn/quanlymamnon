// Package middleware implements the Gin middlewares described in
// docs/ARCHITECTURE.md section 2: TenantResolver, AuthRequired, RequireRole,
// plus request logging and CORS.
package middleware

import (
	"database/sql"
	"sync"
	"time"

	"github.com/gin-gonic/gin"

	"mamnon/backend/internal/response"
)

// Context keys shared by the middleware chain and handlers.
const (
	CtxTenantID     = "tenant_id"
	CtxTenantSlug   = "tenant_slug"
	CtxUserID       = "user_id"
	CtxUserTenantID = "user_tenant_id" // tenant_id claim from the JWT
	CtxUserRoles    = "user_roles"
)

type tenantRecord struct {
	id     string
	status string
}

type cacheEntry struct {
	rec       tenantRecord
	found     bool
	expiresAt time.Time
}

// tenantCache is a short-TTL in-memory cache so every tenant-scoped request
// doesn't need a DB round trip just to resolve the slug.
type tenantCache struct {
	mu  sync.Mutex
	ttl time.Duration
	m   map[string]cacheEntry
}

func newTenantCache(ttl time.Duration) *tenantCache {
	return &tenantCache{ttl: ttl, m: make(map[string]cacheEntry)}
}

func (c *tenantCache) get(slug string) (cacheEntry, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.m[slug]
	if !ok || time.Now().After(e.expiresAt) {
		return cacheEntry{}, false
	}
	return e, true
}

func (c *tenantCache) set(slug string, e cacheEntry) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e.expiresAt = time.Now().Add(c.ttl)
	c.m[slug] = e
}

var defaultTenantCache = newTenantCache(10 * time.Second)

// TenantResolver reads :slug from the URL, looks up the tenant (active
// tenants only) and stores its id in the Gin context. Nothing downstream may
// trust a tenant id from the request body or query string — this is the
// only source of truth for "which tenant".
func TenantResolver(conn *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		slug := c.Param("slug")
		if slug == "" {
			response.NotFound(c, "Không tìm thấy trường")
			return
		}

		entry, ok := defaultTenantCache.get(slug)
		if !ok {
			var rec tenantRecord
			err := conn.QueryRowContext(c.Request.Context(),
				`SELECT id, status FROM tenants WHERE slug = $1`, slug,
			).Scan(&rec.id, &rec.status)

			found := true
			if err == sql.ErrNoRows {
				found = false
			} else if err != nil {
				response.Internal(c)
				return
			}
			entry = cacheEntry{rec: rec, found: found}
			defaultTenantCache.set(slug, entry)
		}

		if !entry.found || entry.rec.status != "active" {
			response.NotFound(c, "Không tìm thấy trường hoặc trường chưa được kích hoạt")
			return
		}

		c.Set(CtxTenantID, entry.rec.id)
		c.Set(CtxTenantSlug, slug)
		c.Next()
	}
}
