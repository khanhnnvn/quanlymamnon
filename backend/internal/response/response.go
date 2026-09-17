// Package response implements the standard API response envelope described
// in docs/ARCHITECTURE.md section 5:
//
//	success: {"data": ...}
//	error:   {"error": {"code": "STRING_CODE", "message": "..."}}
//	paginated success additionally carries "meta": {"page","page_size","total"}
package response

import "github.com/gin-gonic/gin"

// Error codes used across handlers. Keeping them centralized avoids typos
// causing inconsistent client-facing error codes.
const (
	CodeValidation   = "VALIDATION_ERROR"
	CodeUnauthorized = "UNAUTHORIZED"
	CodeForbidden    = "FORBIDDEN"
	CodeNotFound     = "NOT_FOUND"
	CodeConflict     = "CONFLICT"
	CodeInternal     = "INTERNAL_ERROR"
)

type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Meta describes pagination metadata attached to list responses.
type Meta struct {
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
	Total    int `json:"total"`
}

// OK writes a 200 success envelope.
func OK(c *gin.Context, data any) {
	c.JSON(200, gin.H{"data": data})
}

// Created writes a 201 success envelope.
func Created(c *gin.Context, data any) {
	c.JSON(201, gin.H{"data": data})
}

// OKPaginated writes a 200 success envelope with pagination meta.
func OKPaginated(c *gin.Context, data any, meta Meta) {
	c.JSON(200, gin.H{"data": data, "meta": meta})
}

// Fail writes an error envelope with the given HTTP status.
func Fail(c *gin.Context, status int, code, message string) {
	c.AbortWithStatusJSON(status, gin.H{"error": errorBody{Code: code, Message: message}})
}

// BadRequest is a convenience wrapper for 400 VALIDATION_ERROR responses.
func BadRequest(c *gin.Context, message string) {
	Fail(c, 400, CodeValidation, message)
}

// Unauthorized is a convenience wrapper for 401 UNAUTHORIZED responses.
func Unauthorized(c *gin.Context, message string) {
	Fail(c, 401, CodeUnauthorized, message)
}

// Forbidden is a convenience wrapper for 403 FORBIDDEN responses.
func Forbidden(c *gin.Context, message string) {
	Fail(c, 403, CodeForbidden, message)
}

// NotFound is a convenience wrapper for 404 NOT_FOUND responses.
func NotFound(c *gin.Context, message string) {
	Fail(c, 404, CodeNotFound, message)
}

// Conflict is a convenience wrapper for 409 CONFLICT responses.
func Conflict(c *gin.Context, message string) {
	Fail(c, 409, CodeConflict, message)
}

// Internal is a convenience wrapper for 500 INTERNAL_ERROR responses. The
// real error detail is never sent to the client, only logged by the caller.
func Internal(c *gin.Context) {
	Fail(c, 500, CodeInternal, "Đã có lỗi xảy ra, vui lòng thử lại sau")
}
