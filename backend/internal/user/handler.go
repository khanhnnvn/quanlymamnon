package user

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
	db  *sql.DB // needed only to write audit_logs rows on writes
}

func NewHandler(svc *Service, db *sql.DB) *Handler {
	return &Handler{svc: svc, db: db}
}

// RegisterRoutes wires /{slug}/auth/* and /{slug}/users under the tenant
// route group. `authed` is the sub-group that already has TenantResolver +
// AuthRequired + RequireTenantMatch applied; `public` is the tenant group
// with only TenantResolver applied (for login, which precedes auth).
func (h *Handler) RegisterRoutes(public, authed *gin.RouterGroup) {
	public.POST("/auth/login", h.Login)
	public.POST("/auth/refresh", h.Refresh)

	authed.GET("/auth/me", h.Me)

	users := authed.Group("/users")
	users.Use(middleware.RequireRole("SCHOOL_ADMIN", "VICE_ADMIN"))
	{
		users.GET("", h.ListUsers)
		users.POST("", h.CreateUser)
	}
}

func (h *Handler) Login(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)

	var in LoginInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Email hoặc mật khẩu không hợp lệ")
		return
	}

	tp, err := h.svc.Login(c.Request.Context(), tenantID, in)
	if err != nil {
		writeAuthError(c, err)
		return
	}

	response.OK(c, gin.H{
		"access_token":  tp.AccessToken,
		"refresh_token": tp.RefreshToken,
		"user": gin.H{
			"id":        tp.UserID,
			"full_name": tp.FullName,
			"roles":     tp.Roles,
		},
	})
}

func (h *Handler) Refresh(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)

	var in RefreshInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Thiếu refresh_token")
		return
	}

	tp, err := h.svc.Refresh(c.Request.Context(), tenantID, in)
	if err != nil {
		writeAuthError(c, err)
		return
	}

	response.OK(c, gin.H{
		"access_token":  tp.AccessToken,
		"refresh_token": tp.RefreshToken,
	})
}

func (h *Handler) Me(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	userID := middleware.UserIDFromContext(c)

	u, err := h.svc.Me(c.Request.Context(), tenantID, userID)
	if err != nil {
		response.Unauthorized(c, "Không tìm thấy phiên đăng nhập")
		return
	}
	response.OK(c, u)
}

func (h *Handler) ListUsers(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	p := pagination.Parse(c)

	items, total, err := h.svc.ListUsers(c.Request.Context(), tenantID, p.Limit, p.Offset)
	if err != nil {
		response.Internal(c)
		return
	}
	if items == nil {
		items = []User{}
	}
	response.OKPaginated(c, items, response.Meta{Page: p.Page, PageSize: p.PageSize, Total: total})
}

func (h *Handler) CreateUser(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	actorID := middleware.UserIDFromContext(c)

	var in CreateUserInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Dữ liệu người dùng không hợp lệ")
		return
	}

	u, err := h.svc.CreateUser(c.Request.Context(), tenantID, in)
	if err != nil {
		if errors.Is(err, ErrRoleNotFound) {
			response.BadRequest(c, "Một hoặc nhiều vai trò (role_codes) không tồn tại")
			return
		}
		response.Internal(c)
		return
	}

	audit.Log(c.Request.Context(), h.db, tenantID, actorID, "CREATE", "users", u.ID, map[string]any{"email": u.Email})
	response.Created(c, u)
}

func writeAuthError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrInvalidCredentials), errors.Is(err, ErrInvalidRefresh):
		response.Unauthorized(c, "Thông tin đăng nhập không đúng")
	case errors.Is(err, ErrAccountLocked):
		response.Fail(c, 401, response.CodeUnauthorized, "Tài khoản tạm khóa do đăng nhập sai nhiều lần, vui lòng thử lại sau")
	case errors.Is(err, ErrAccountDisabled):
		response.Unauthorized(c, "Tài khoản đã bị vô hiệu hóa")
	default:
		response.Internal(c)
	}
}
