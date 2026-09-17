// Package announcement implements announcements —
// docs/ARCHITECTURE.md section 5.2 (M9).
package announcement

import "time"

type Announcement struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Content     string     `json:"content"`
	Audience    string     `json:"audience"`
	GradeID     string     `json:"grade_id,omitempty"`
	ClassID     string     `json:"class_id,omitempty"`
	IsUrgent    bool       `json:"is_urgent"`
	CreatedBy   string     `json:"created_by"`
	PublishedAt *time.Time `json:"published_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

// CreateAnnouncementInput is POST /{slug}/announcements.
type CreateAnnouncementInput struct {
	Title    string `json:"title" binding:"required"`
	Content  string `json:"content" binding:"required"`
	Audience string `json:"audience" binding:"required,oneof=school grade class"`
	GradeID  string `json:"grade_id"`
	ClassID  string `json:"class_id"`
	IsUrgent bool   `json:"is_urgent"`
	Publish  bool   `json:"publish"`
}
