package journal

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
	teacherOnly := middleware.RequireRole("TEACHER", "ASSISTANT_TEACHER")
	readClass := middleware.RequireRole("SCHOOL_ADMIN", "VICE_ADMIN", "TEACHER", "ASSISTANT_TEACHER")
	withParent := middleware.RequireRole("SCHOOL_ADMIN", "VICE_ADMIN", "TEACHER", "ASSISTANT_TEACHER", "PARENT")

	j := authed.Group("/journals")
	{
		j.GET("", readClass, h.ListByClass)
		j.POST("", teacherOnly, h.Create)
		j.GET("/student/:id", withParent, h.ListByStudent)
	}
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	actorID := middleware.UserIDFromContext(c)
	roles := middleware.RolesFromContext(c)

	var in CreateJournalInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Dữ liệu nhật ký không hợp lệ")
		return
	}

	j, err := h.svc.Create(c.Request.Context(), tenantID, actorID, roles, in)
	if err != nil {
		if errors.Is(err, ErrForbidden) {
			response.Forbidden(c, "Bạn chỉ có thể đăng nhật ký cho lớp mình phụ trách")
			return
		}
		response.Internal(c)
		return
	}

	audit.Log(c.Request.Context(), h.db, tenantID, actorID, "CREATE", "journals", j.ID, map[string]any{"class_id": j.ClassID})
	response.Created(c, j)
}

func (h *Handler) ListByClass(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	actorID := middleware.UserIDFromContext(c)
	roles := middleware.RolesFromContext(c)
	p := pagination.Parse(c)

	classID := c.Query("class_id")
	if classID == "" {
		response.BadRequest(c, "Thiếu tham số class_id")
		return
	}
	date := c.Query("date")

	items, total, err := h.svc.ListByClass(c.Request.Context(), tenantID, actorID, roles, classID, date, p.Limit, p.Offset)
	if err != nil {
		if errors.Is(err, ErrForbidden) {
			response.Forbidden(c, "Bạn không có quyền xem nhật ký lớp này")
			return
		}
		response.Internal(c)
		return
	}
	if items == nil {
		items = []Journal{}
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
			response.Forbidden(c, "Bạn không có quyền xem nhật ký học sinh này")
			return
		}
		response.Internal(c)
		return
	}
	if items == nil {
		items = []Journal{}
	}
	response.OKPaginated(c, items, response.Meta{Page: p.Page, PageSize: p.PageSize, Total: total})
}
