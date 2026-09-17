package attendance

import (
	"database/sql"
	"errors"

	"github.com/gin-gonic/gin"

	"mamnon/backend/internal/audit"
	"mamnon/backend/internal/middleware"
	"mamnon/backend/internal/pagination"
	"mamnon/backend/internal/response"
)

type Handler struct {
	svc *Service
	db  *sql.DB
}

func NewHandler(svc *Service, db *sql.DB) *Handler {
	return &Handler{svc: svc, db: db}
}

func (h *Handler) RegisterRoutes(authed *gin.RouterGroup) {
	roleGuard := middleware.RequireRole("SCHOOL_ADMIN", "VICE_ADMIN", "TEACHER", "ASSISTANT_TEACHER")
	roleGuardWithParent := middleware.RequireRole("SCHOOL_ADMIN", "VICE_ADMIN", "TEACHER", "ASSISTANT_TEACHER", "PARENT")

	att := authed.Group("/attendance")
	{
		att.GET("", roleGuard, h.ListByClass)
		att.POST("", roleGuard, h.Record)
		att.GET("/student/:id", roleGuardWithParent, h.ListByStudent)
	}
}

func (h *Handler) Record(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	actorID := middleware.UserIDFromContext(c)
	roles := middleware.RolesFromContext(c)

	var in RecordInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Dữ liệu điểm danh không hợp lệ")
		return
	}

	a, err := h.svc.Record(c.Request.Context(), tenantID, actorID, roles, in)
	if err != nil {
		if errors.Is(err, ErrForbidden) {
			response.Forbidden(c, "Bạn chỉ có thể điểm danh cho lớp mình phụ trách")
			return
		}
		response.Internal(c)
		return
	}

	audit.Log(c.Request.Context(), h.db, tenantID, actorID, "RECORD", "attendance", a.ID,
		map[string]any{"student_id": a.StudentID, "date": a.Date, "status": a.Status})
	response.Created(c, a)
}

func (h *Handler) ListByClass(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	actorID := middleware.UserIDFromContext(c)
	roles := middleware.RolesFromContext(c)
	p := pagination.Parse(c)

	classID := c.Query("class_id")
	date := c.Query("date")
	if classID == "" || date == "" {
		response.BadRequest(c, "Thiếu tham số class_id hoặc date")
		return
	}

	items, total, err := h.svc.ListByClass(c.Request.Context(), tenantID, actorID, roles, classID, date, p.Limit, p.Offset)
	if err != nil {
		if errors.Is(err, ErrForbidden) {
			response.Forbidden(c, "Bạn không có quyền xem điểm danh lớp này")
			return
		}
		response.Internal(c)
		return
	}
	if items == nil {
		items = []Attendance{}
	}
	response.OKPaginated(c, items, response.Meta{Page: p.Page, PageSize: p.PageSize, Total: total})
}

func (h *Handler) ListByStudent(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	actorID := middleware.UserIDFromContext(c)
	roles := middleware.RolesFromContext(c)
	p := pagination.Parse(c)

	items, total, err := h.svc.ListByStudent(c.Request.Context(), tenantID, actorID, roles, c.Param("id"), p.Limit, p.Offset)
	if err != nil {
		if errors.Is(err, ErrForbidden) {
			response.Forbidden(c, "Bạn không có quyền xem điểm danh học sinh này")
			return
		}
		response.Internal(c)
		return
	}
	if items == nil {
		items = []Attendance{}
	}
	response.OKPaginated(c, items, response.Meta{Page: p.Page, PageSize: p.PageSize, Total: total})
}
