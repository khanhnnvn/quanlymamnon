// Package attendance implements daily attendance —
// docs/ARCHITECTURE.md section 5.2 (M5).
package attendance

import "time"

type Attendance struct {
	ID           string     `json:"id"`
	StudentID    string     `json:"student_id"`
	ClassID      string     `json:"class_id"`
	Date         string     `json:"date"`
	Status       string     `json:"status"`
	CheckInTime  *time.Time `json:"check_in_time,omitempty"`
	CheckOutTime *time.Time `json:"check_out_time,omitempty"`
	PickedUpBy   string     `json:"picked_up_by,omitempty"`
	Note         string     `json:"note,omitempty"`
	RecordedBy   string     `json:"recorded_by"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// RecordInput is POST /{slug}/attendance. It upserts one attendance row per
// (student, date) — a teacher re-submitting the same day updates the record
// rather than erroring, matching the UNIQUE(tenant_id, student_id, date)
// constraint.
type RecordInput struct {
	StudentID    string  `json:"student_id" binding:"required"`
	ClassID      string  `json:"class_id" binding:"required"`
	Date         string  `json:"date" binding:"required"`
	Status       string  `json:"status" binding:"required,oneof=present absent late excused"`
	CheckInTime  *string `json:"check_in_time"`
	CheckOutTime *string `json:"check_out_time"`
	PickedUpBy   string  `json:"picked_up_by"`
	Note         string  `json:"note"`
}
