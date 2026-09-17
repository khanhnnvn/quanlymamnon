// Package pagination parses the standard `?page=&page_size=` query
// parameters shared by every list endpoint (docs/ARCHITECTURE.md section 5).
package pagination

import (
	"strconv"

	"github.com/gin-gonic/gin"
)

const (
	defaultPage     = 1
	defaultPageSize = 20
	maxPageSize     = 100
)

// Params holds the parsed page/page_size plus the computed SQL LIMIT/OFFSET.
type Params struct {
	Page     int
	PageSize int
	Limit    int
	Offset   int
}

// Parse reads page/page_size from the query string, applying sane defaults
// and bounds.
func Parse(c *gin.Context) Params {
	page, err := strconv.Atoi(c.Query("page"))
	if err != nil || page < 1 {
		page = defaultPage
	}

	pageSize, err := strconv.Atoi(c.Query("page_size"))
	if err != nil || pageSize < 1 {
		pageSize = defaultPageSize
	}
	if pageSize > maxPageSize {
		pageSize = maxPageSize
	}

	return Params{
		Page:     page,
		PageSize: pageSize,
		Limit:    pageSize,
		Offset:   (page - 1) * pageSize,
	}
}
