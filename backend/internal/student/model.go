// Package student implements students + student_parents —
// docs/ARCHITECTURE.md section 5.2 (M4).
package student

import "time"

type ParentLink struct {
	ParentUserID     string `json:"parent_user_id"`
	FullName         string `json:"full_name"`
	Relationship     string `json:"relationship,omitempty"`
	IsPrimaryContact bool   `json:"is_primary_contact"`
	CanPickup        bool   `json:"can_pickup"`
}

type Student struct {
	ID             string       `json:"id"`
	FullName       string       `json:"full_name"`
	DOB            string       `json:"dob,omitempty"`
	Gender         string       `json:"gender,omitempty"`
	AvatarURL      string       `json:"avatar_url,omitempty"`
	CurrentClassID string       `json:"current_class_id,omitempty"`
	Status         string       `json:"status"`
	EnrollmentDate string       `json:"enrollment_date,omitempty"`
	Note           string       `json:"note,omitempty"`
	Parents        []ParentLink `json:"parents,omitempty"`
	CreatedAt      time.Time    `json:"created_at"`
	UpdatedAt      time.Time    `json:"updated_at"`
}

type CreateStudentInput struct {
	FullName       string `json:"full_name" binding:"required"`
	DOB            string `json:"dob"`
	Gender         string `json:"gender"`
	AvatarURL      string `json:"avatar_url"`
	CurrentClassID string `json:"current_class_id"`
	Status         string `json:"status"`
	EnrollmentDate string `json:"enrollment_date"`
	Note           string `json:"note"`
}

// UpdateStudentInput is the PATCH /students/:id request body. Pointer
// fields distinguish "not provided" from "set to empty".
type UpdateStudentInput struct {
	FullName       *string `json:"full_name"`
	DOB            *string `json:"dob"`
	Gender         *string `json:"gender"`
	AvatarURL      *string `json:"avatar_url"`
	CurrentClassID *string `json:"current_class_id"`
	Status         *string `json:"status"`
	EnrollmentDate *string `json:"enrollment_date"`
	Note           *string `json:"note"`
}

type LinkParentInput struct {
	ParentUserID     string `json:"parent_user_id" binding:"required"`
	Relationship     string `json:"relationship"`
	IsPrimaryContact bool   `json:"is_primary_contact"`
	CanPickup        bool   `json:"can_pickup"`
}
