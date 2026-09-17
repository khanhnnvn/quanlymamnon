package dashboard

import (
	"github.com/gin-gonic/gin"

	"mamnon/backend/internal/middleware"
	"mamnon/backend/internal/response"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) RegisterRoutes(authed *gin.RouterGroup) {
	authed.GET("/dashboard/summary", h.Summary)
}

func (h *Handler) Summary(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	userID := middleware.UserIDFromContext(c)
	roles := middleware.RolesFromContext(c)

	data, err := h.svc.Summary(c.Request.Context(), tenantID, userID, roles)
	if err != nil {
		response.Internal(c)
		return
	}
	response.OK(c, data)
}
