// Package journal implements daily_journals — docs/ARCHITECTURE.md
// section 5.2 (M8).
package journal

import "time"

type Journal struct {
	ID        string    `json:"id"`
	ClassID   string    `json:"class_id"`
	StudentID string    `json:"student_id,omitempty"`
	Date      string    `json:"date"`
	Content   string    `json:"content"`
	PhotoURLs []string  `json:"photo_urls"`
	CreatedBy string    `json:"created_by"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateJournalInput is POST /{slug}/journals. StudentID is optional — a
// journal entry can target a whole class or one specific student.
type CreateJournalInput struct {
	ClassID   string   `json:"class_id" binding:"required"`
	StudentID string   `json:"student_id"`
	Date      string   `json:"date" binding:"required"`
	Content   string   `json:"content" binding:"required"`
	PhotoURLs []string `json:"photo_urls"`
}
