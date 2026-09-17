package middleware

import (
	"log"
	"time"

	"github.com/gin-gonic/gin"
)

// RequestLogger is a minimal structured access log: method, path, status,
// latency. Satisfies the "ghi log truy cập API" requirement in SRS.md
// section 6 without pulling in an extra logging dependency.
func RequestLogger() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.Request.URL.Path
		c.Next()
		log.Printf("%s %s %d %s", c.Request.Method, path, c.Writer.Status(), time.Since(start))
	}
}
