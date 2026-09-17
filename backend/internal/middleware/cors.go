package middleware

import "github.com/gin-gonic/gin"

// CORS restricts cross-origin requests to ALLOWED_ORIGIN (default "*" for
// local development). Production does not need this because the frontend
// calls the API same-origin via Next.js rewrites, but it is kept as a
// defensive layer for direct API access / local dev.
func CORS(allowedOrigin string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", allowedOrigin)
		c.Header("Vary", "Origin")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
