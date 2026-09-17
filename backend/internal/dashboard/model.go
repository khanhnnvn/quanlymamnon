// Package dashboard implements GET /{slug}/dashboard/summary —
// docs/ARCHITECTURE.md section 5.2 (M17). Content varies by role.
package dashboard

type AdminSummary struct {
	TotalStudents       int `json:"total_students"`
	TotalClasses        int `json:"total_classes"`
	TotalStaff          int `json:"total_staff"`
	TodayPresentCount   int `json:"today_present_count"`
	TodayAbsentCount    int `json:"today_absent_count"`
	RecentAnnouncements int `json:"recent_announcements"`
}

type TeacherClassInfo struct {
	ClassID           string `json:"class_id"`
	ClassName         string `json:"class_name"`
	StudentCount      int    `json:"student_count"`
	TodayPresentCount int    `json:"today_present_count"`
}

type TeacherSummary struct {
	Classes []TeacherClassInfo `json:"classes"`
}

type ParentChildInfo struct {
	StudentID             string `json:"student_id"`
	FullName              string `json:"full_name"`
	TodayAttendanceStatus string `json:"today_attendance_status,omitempty"`
	RecentJournalCount    int    `json:"recent_journal_count"`
}

type ParentSummary struct {
	Children []ParentChildInfo `json:"children"`
}

// GenericSummary is used for roles without a dedicated v1 dashboard
// (Accountant/Nurse/Cook/Security/Office Staff/Head Teacher) since their
// business modules are phase 2+.
type GenericSummary struct {
	TenantName string   `json:"tenant_name"`
	Roles      []string `json:"roles"`
	Message    string   `json:"message"`
}
