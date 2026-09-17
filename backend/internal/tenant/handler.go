package tenant

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

// RegisterRoutes wires up /system/auth/login (public) and /system/tenants/*
// (Super Admin only) per docs/ARCHITECTURE.md section 5.1.
func (h *Handler) RegisterRoutes(rg *gin.RouterGroup, jwtSecret string) {
	rg.POST("/system/auth/login", h.Login)

	admin := rg.Group("/system")
	admin.Use(middleware.AuthRequired(jwtSecret), middleware.RequireSystemAdmin())
	{
		admin.GET("/tenants", h.ListTenants)
		admin.POST("/tenants", h.CreateTenant)
		admin.GET("/tenants/:id", h.GetTenant)
		admin.PATCH("/tenants/:id", h.UpdateTenant)
	}
}

func (h *Handler) Login(c *gin.Context) {
	var in LoginInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Email hoặc mật khẩu không hợp lệ")
		return
	}

	result, err := h.svc.Login(c.Request.Context(), in)
	if err != nil {
		switch {
		case errors.Is(err, ErrInvalidCredentials):
			response.Unauthorized(c, "Email hoặc mật khẩu không đúng")
		case errors.Is(err, ErrAccountLocked):
			response.Fail(c, 401, response.CodeUnauthorized, "Tài khoản tạm khóa do đăng nhập sai nhiều lần, vui lòng thử lại sau")
		case errors.Is(err, ErrAccountDisabled):
			response.Unauthorized(c, "Tài khoản đã bị vô hiệu hóa")
		default:
			response.Internal(c)
		}
		return
	}

	response.OK(c, gin.H{
		"access_token":  result.AccessToken,
		"refresh_token": result.RefreshToken,
		"user": gin.H{
			"id":        result.UserID,
			"full_name": result.FullName,
			"roles":     result.Roles,
		},
	})
}

func (h *Handler) CreateTenant(c *gin.Context) {
	var in CreateTenantInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Dữ liệu tạo trường không hợp lệ")
		return
	}

	result, err := h.svc.CreateTenant(c.Request.Context(), in)
	if err != nil {
		response.Internal(c)
		return
	}

	body := gin.H{
		"tenant": result.Tenant,
		"admin_user": gin.H{
			"id":    result.AdminID,
			"email": result.AdminEmail,
		},
	}
	if result.TempPassword != "" {
		body["admin_temp_password"] = result.TempPassword
	}
	response.Created(c, body)
}

func (h *Handler) ListTenants(c *gin.Context) {
	p := pagination.Parse(c)
	status := c.Query("status")

	items, total, err := h.svc.ListTenants(c.Request.Context(), status, p.Limit, p.Offset)
	if err != nil {
		response.Internal(c)
		return
	}
	if items == nil {
		items = []Tenant{}
	}

	response.OKPaginated(c, items, response.Meta{Page: p.Page, PageSize: p.PageSize, Total: total})
}

func (h *Handler) GetTenant(c *gin.Context) {
	t, err := h.svc.GetTenant(c.Request.Context(), c.Param("id"))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(c, "Không tìm thấy trường")
			return
		}
		response.Internal(c)
		return
	}
	response.OK(c, t)
}

func (h *Handler) UpdateTenant(c *gin.Context) {
	var in UpdateTenantInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Dữ liệu cập nhật không hợp lệ")
		return
	}
	if in.Status != nil && !validTenantStatus(*in.Status) {
		response.BadRequest(c, "Trạng thái không hợp lệ")
		return
	}

	t, err := h.svc.UpdateTenant(c.Request.Context(), c.Param("id"), in)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			response.NotFound(c, "Không tìm thấy trường")
			return
		}
		response.Internal(c)
		return
	}
	response.OK(c, t)
}

func validTenantStatus(s string) bool {
	switch s {
	case "pending", "active", "suspended", "archived":
		return true
	}
	return false
}
