package school

import (
	"database/sql"
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

// RegisterRoutes wires school-years/grades/classes under the authenticated
// tenant group per docs/ARCHITECTURE.md section 5.2.
func (h *Handler) RegisterRoutes(authed *gin.RouterGroup) {
	adminOnly := middleware.RequireRole("SCHOOL_ADMIN", "VICE_ADMIN")
	readClasses := middleware.RequireRole("SCHOOL_ADMIN", "VICE_ADMIN", "HEAD_TEACHER", "TEACHER", "ASSISTANT_TEACHER")

	years := authed.Group("/school-years")
	years.Use(adminOnly)
	{
		years.GET("", h.ListSchoolYears)
		years.POST("", h.CreateSchoolYear)
		years.PATCH("/:id", h.UpdateSchoolYear)
	}

	grades := authed.Group("/grades")
	grades.Use(adminOnly)
	{
		grades.GET("", h.ListGrades)
		grades.POST("", h.CreateGrade)
	}

	classes := authed.Group("/classes")
	{
		classes.GET("", readClasses, h.ListClasses)
		classes.POST("", adminOnly, h.CreateClass)
		classes.PATCH("/:id", adminOnly, h.UpdateClass)
		classes.POST("/:id/teachers", adminOnly, h.AssignTeacher)
	}
}

func (h *Handler) CreateSchoolYear(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)

	var in CreateSchoolYearInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Dữ liệu năm học không hợp lệ")
		return
	}

	sy, err := h.svc.CreateSchoolYear(c.Request.Context(), tenantID, in)
	if err != nil {
		response.Internal(c)
		return
	}
	response.Created(c, sy)
}

func (h *Handler) ListSchoolYears(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	p := pagination.Parse(c)

	items, total, err := h.svc.ListSchoolYears(c.Request.Context(), tenantID, p.Limit, p.Offset)
	if err != nil {
		response.Internal(c)
		return
	}
	if items == nil {
		items = []SchoolYear{}
	}
	response.OKPaginated(c, items, response.Meta{Page: p.Page, PageSize: p.PageSize, Total: total})
}

func (h *Handler) UpdateSchoolYear(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)

	var in UpdateSchoolYearInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Dữ liệu cập nhật không hợp lệ")
		return
	}

	sy, err := h.svc.UpdateSchoolYear(c.Request.Context(), tenantID, c.Param("id"), in)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.NotFound(c, "Không tìm thấy năm học")
			return
		}
		response.Internal(c)
		return
	}
	response.OK(c, sy)
}

func (h *Handler) CreateGrade(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)

	var in CreateGradeInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Dữ liệu khối không hợp lệ")
		return
	}

	g, err := h.svc.CreateGrade(c.Request.Context(), tenantID, in)
	if err != nil {
		response.Internal(c)
		return
	}
	response.Created(c, g)
}

func (h *Handler) ListGrades(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	p := pagination.Parse(c)

	items, total, err := h.svc.ListGrades(c.Request.Context(), tenantID, p.Limit, p.Offset)
	if err != nil {
		response.Internal(c)
		return
	}
	if items == nil {
		items = []Grade{}
	}
	response.OKPaginated(c, items, response.Meta{Page: p.Page, PageSize: p.PageSize, Total: total})
}

func (h *Handler) CreateClass(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)

	var in CreateClassInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Dữ liệu lớp không hợp lệ")
		return
	}

	cl, err := h.svc.CreateClass(c.Request.Context(), tenantID, in)
	if err != nil {
		response.Internal(c)
		return
	}
	response.Created(c, cl)
}

func (h *Handler) ListClasses(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	userID := middleware.UserIDFromContext(c)
	roles := middleware.RolesFromContext(c)
	p := pagination.Parse(c)

	items, total, err := h.svc.ListClasses(c.Request.Context(), tenantID, userID, roles, p.Limit, p.Offset)
	if err != nil {
		response.Internal(c)
		return
	}
	if items == nil {
		items = []Class{}
	}
	response.OKPaginated(c, items, response.Meta{Page: p.Page, PageSize: p.PageSize, Total: total})
}

func (h *Handler) UpdateClass(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)

	var in UpdateClassInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Dữ liệu cập nhật lớp không hợp lệ")
		return
	}

	cl, err := h.svc.UpdateClass(c.Request.Context(), tenantID, c.Param("id"), in)
	if err != nil {
		if errors.Is(err, ErrClassNotFound) {
			response.NotFound(c, "Không tìm thấy lớp")
			return
		}
		response.Internal(c)
		return
	}
	response.OK(c, cl)
}

func (h *Handler) AssignTeacher(c *gin.Context) {
	tenantID := middleware.TenantIDFromContext(c)
	classID := c.Param("id")

	var in AssignTeacherInput
	if err := c.ShouldBindJSON(&in); err != nil {
		response.BadRequest(c, "Dữ liệu phân công giáo viên không hợp lệ")
		return
	}

	cl, err := h.svc.AssignTeacher(c.Request.Context(), tenantID, classID, in)
	if err != nil {
		if errors.Is(err, ErrClassNotFound) {
			response.NotFound(c, "Không tìm thấy lớp")
			return
		}
		response.Internal(c)
		return
	}
	response.OK(c, cl)
}
