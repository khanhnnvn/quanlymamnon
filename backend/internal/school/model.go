// Package school implements school_years, grades, classes and
// class_teachers — docs/ARCHITECTURE.md sections 4.1 and 5.2 (M3).
package school

import "time"

type SchoolYear struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	StartDate string    `json:"start_date"`
	EndDate   string    `json:"end_date"`
	IsCurrent bool      `json:"is_current"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type CreateSchoolYearInput struct {
	Name      string `json:"name" binding:"required"`
	StartDate string `json:"start_date" binding:"required"`
	EndDate   string `json:"end_date" binding:"required"`
	IsCurrent bool   `json:"is_current"`
}

type UpdateSchoolYearInput struct {
	Name      *string `json:"name"`
	StartDate *string `json:"start_date"`
	EndDate   *string `json:"end_date"`
	IsCurrent *bool   `json:"is_current"`
}

type Grade struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	SortOrder int       `json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateGradeInput struct {
	Name      string `json:"name" binding:"required"`
	SortOrder int    `json:"sort_order"`
}

type ClassTeacherRef struct {
	UserID      string `json:"user_id"`
	FullName    string `json:"full_name"`
	RoleInClass string `json:"role_in_class"`
}

type Class struct {
	ID           string            `json:"id"`
	SchoolYearID string            `json:"school_year_id"`
	GradeID      string            `json:"grade_id"`
	Name         string            `json:"name"`
	Capacity     int               `json:"capacity"`
	Teachers     []ClassTeacherRef `json:"teachers"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

type CreateClassInput struct {
	SchoolYearID string `json:"school_year_id" binding:"required"`
	GradeID      string `json:"grade_id" binding:"required"`
	Name         string `json:"name" binding:"required"`
	Capacity     int    `json:"capacity"`
}

// UpdateClassInput is the PATCH /classes/:id request body. Pointer fields
// distinguish "not provided" from "set to empty".
type UpdateClassInput struct {
	Name     *string `json:"name"`
	GradeID  *string `json:"grade_id"`
	Capacity *int    `json:"capacity"`
}

type AssignTeacherInput struct {
	UserID      string `json:"user_id" binding:"required"`
	RoleInClass string `json:"role_in_class" binding:"required,oneof=main assistant"`
}
