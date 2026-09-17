package student

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
	writeRoles := middleware.RequireRole("SCHOOL_ADMIN", "VICE_ADMIN", "TEACHER")
	readWithParent := middleware.RequireRole("SCHOOL_ADMIN", "VICE_ADMIN", "TEACHER", "PARENT")
	adminOnly := middleware.RequireRole("SCHOOL_ADMIN", "VICE_ADMIN")

	students := authed.Group("/students")
	{
		students.GET("", writeRoles, h.List)
		students.POST("", writeRoles, h.Create)
		students.GET("/:id", readWithParent, h.Get)
		students.PATCH("/:id", writeRoles, h.Update)
		students.POST("/:id/parents", adminOnly, h.LinkParent)
	}
}

func (h *Handler) Create(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	actorID := middleware.UserIDFromContext(c)
	roles := middleware.RolesFromContext(c)

	var in CreateStudentInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Dữ liệu học sinh không hợp lệ")
		return
	}

	st, err := h.svc.CreateStudent(c.Request.Context(), tenantID, actorID, roles, in)
	if err != nil {
		if errors.Is(err, ErrForbidden) {
			response.Forbidden(c, "Bạn chỉ có thể thêm học sinh vào lớp mình phụ trách")
			return
		}
		response.Internal(c)
		return
	}

	audit.Log(c.Request.Context(), h.db, tenantID, actorID, "CREATE", "students", st.ID, map[string]any{"full_name": st.FullName})
	response.Created(c, st)
}

func (h *Handler) List(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	actorID := middleware.UserIDFromContext(c)
	roles := middleware.RolesFromContext(c)
	p := pagination.Parse(c)
	classFilter := c.Query("class_id")

	items, total, err := h.svc.ListStudents(c.Request.Context(), tenantID, actorID, roles, classFilter, p.Limit, p.Offset)
	if err != nil {
		response.Internal(c)
		return
	}
	if items == nil {
		items = []Student{}
	}
	response.OKPaginated(c, items, response.Meta{Page: p.Page, PageSize: p.PageSize, Total: total})
}

func (h *Handler) Get(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	actorID := middleware.UserIDFromContext(c)
	roles := middleware.RolesFromContext(c)

	st, err := h.svc.GetStudent(c.Request.Context(), tenantID, actorID, roles, c.Param("id"))
	if err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			response.NotFound(c, "Không tìm thấy học sinh")
		case errors.Is(err, ErrForbidden):
			response.Forbidden(c, "Bạn không có quyền xem học sinh này")
		default:
			response.Internal(c)
		}
		return
	}
	response.OK(c, st)
}

func (h *Handler) Update(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	actorID := middleware.UserIDFromContext(c)
	roles := middleware.RolesFromContext(c)
	studentID := c.Param("id")

	var in UpdateStudentInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Dữ liệu cập nhật học sinh không hợp lệ")
		return
	}

	st, err := h.svc.UpdateStudent(c.Request.Context(), tenantID, actorID, roles, studentID, in)
	if err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			response.NotFound(c, "Không tìm thấy học sinh")
		case errors.Is(err, ErrForbidden):
			response.Forbidden(c, "Bạn chỉ có thể sửa học sinh trong lớp mình phụ trách")
		default:
			response.Internal(c)
		}
		return
	}

	audit.Log(c.Request.Context(), h.db, tenantID, actorID, "UPDATE", "students", studentID, map[string]any{"full_name": st.FullName})
	response.OK(c, st)
}

func (h *Handler) LinkParent(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	actorID := middleware.UserIDFromContext(c)
	studentID := c.Param("id")

	var in LinkParentInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Dữ liệu liên kết phụ huynh không hợp lệ")
		return
	}

	if err := h.svc.LinkParent(c.Request.Context(), tenantID, studentID, in); err != nil {
		response.Internal(c)
		return
	}

	audit.Log(c.Request.Context(), h.db, tenantID, actorID, "LINK_PARENT", "students", studentID, map[string]any{"parent_user_id": in.ParentUserID})
	response.Created(c, gin.H{"student_id": studentID, "parent_user_id": in.ParentUserID})
}
