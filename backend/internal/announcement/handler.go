package announcement

import (
	"errors"

	"github.com/gin-gonic/gin"

	"mamnon/backend/internal/middleware"
	"mamnon/backend/internal/pagination"
	"mamnon/backend/internal/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(authed *gin.RouterGroup) {
	writeGuard := middleware.RequireRole("SCHOOL_ADMIN", "VICE_ADMIN", "TEACHER")
	readGuard := middleware.RequireRole("SCHOOL_ADMIN", "VICE_ADMIN", "TEACHER", "ASSISTANT_TEACHER", "PARENT")

	ann := authed.Group("/announcements")
	{
		ann.GET("", readGuard, h.List)
		ann.POST("", writeGuard, h.Create)
	}
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	actorID := middleware.UserIDFromContext(c)
	roles := middleware.RolesFromContext(c)

	var in CreateAnnouncementInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Dữ liệu thông báo không hợp lệ")
		return
	}

	a, err := h.svc.Create(c.Request.Context(), tenantID, actorID, roles, in)
	if err != nil {
		if errors.Is(err, ErrForbidden) {
			response.Forbidden(c, "Bạn không có quyền gửi thông báo với phạm vi này")
			return
		}
		response.Internal(c)
		return
	}
	response.Created(c, a)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	actorID := middleware.UserIDFromContext(c)
	roles := middleware.RolesFromContext(c)
	p := pagination.Parse(c)

	items, total, err := h.svc.List(c.Request.Context(), tenantID, actorID, roles, p.Limit, p.Offset)
	if err != nil {
		if errors.Is(err, ErrForbidden) {
			response.Forbidden(c, "Bạn không có quyền xem thông báo")
			return
		}
		response.Internal(c)
		return
	}
	if items == nil {
		items = []Announcement{}
	}
	response.OKPaginated(c, items, response.Meta{Page: p.Page, PageSize: p.PageSize, Total: total})
}
