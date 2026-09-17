// Mirror của lược đồ CSDL / API contract ở docs/ARCHITECTURE.md muc 4 & 5.

export type TenantStatus = "pending" | "active" | "suspended" | "archived";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  plan?: string | null;
  status: TenantStatus;
  settings?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Có thể backend trả kèm thống kê sử dụng cho danh sách trường.
  student_count?: number;
  user_count?: number;
}

/** 12 vai trò cố định seed sẵn - docs/ARCHITECTURE.md muc 3. */
export type RoleCode =
  | "SUPER_ADMIN"
  | "SCHOOL_ADMIN"
  | "VICE_ADMIN"
  | "HEAD_TEACHER"
  | "TEACHER"
  | "ASSISTANT_TEACHER"
  | "ACCOUNTANT"
  | "NURSE"
  | "COOK"
  | "SECURITY"
  | "OFFICE_STAFF"
  | "PARENT";

export interface Role {
  id: string;
  code: RoleCode;
  name: string;
}

export const ROLE_LABELS: Record<RoleCode, string> = {
  SUPER_ADMIN: "Quản trị hệ thống",
  SCHOOL_ADMIN: "Hiệu trưởng",
  VICE_ADMIN: "Hiệu phó",
  HEAD_TEACHER: "Tổ trưởng chuyên môn",
  TEACHER: "Giáo viên chính",
  ASSISTANT_TEACHER: "Giáo viên phụ / Trợ giảng",
  ACCOUNTANT: "Kế toán",
  NURSE: "Y tế",
  COOK: "Cấp dưỡng",
  SECURITY: "Bảo vệ",
  OFFICE_STAFF: "Văn thư / Nhân viên",
  PARENT: "Phụ huynh",
};

export const STAFF_ROLE_CODES: RoleCode[] = [
  "SCHOOL_ADMIN",
  "VICE_ADMIN",
  "HEAD_TEACHER",
  "TEACHER",
  "ASSISTANT_TEACHER",
  "ACCOUNTANT",
  "NURSE",
  "COOK",
  "SECURITY",
  "OFFICE_STAFF",
];

export type UserStatus = "active" | "disabled";

export interface User {
  id: string;
  tenant_id: string | null;
  email: string;
  phone?: string | null;
  full_name: string;
  avatar_url?: string | null;
  status: UserStatus;
  failed_login_count?: number;
  locked_until?: string | null;
  roles?: RoleCode[];
  created_at: string;
  updated_at: string;
}

export interface SchoolYear {
  id: string;
  tenant_id: string;
  name: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
}

export interface Grade {
  id: string;
  tenant_id: string;
  name: string;
  sort_order: number;
}

export type ClassTeacherRole = "main" | "assistant";

export interface ClassTeacher {
  id: string;
  tenant_id: string;
  class_id: string;
  user_id: string;
  role_in_class: ClassTeacherRole;
  user_full_name?: string;
  user_email?: string;
}

export interface SchoolClass {
  id: string;
  tenant_id: string;
  school_year_id: string;
  grade_id: string;
  name: string;
  capacity: number;
  created_at: string;
  updated_at: string;
  // Các trường mở rộng thường được backend join kèm để đỡ phải gọi nhiều API.
  grade_name?: string;
  school_year_name?: string;
  student_count?: number;
  teachers?: ClassTeacher[];
}

export type StudentStatus = "enrolled" | "on_leave" | "withdrawn";

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  enrolled: "Đang học",
  on_leave: "Bảo lưu",
  withdrawn: "Thôi học",
};

export interface StudentParent {
  id: string;
  tenant_id: string;
  student_id: string;
  parent_user_id: string;
  relationship?: string | null;
  is_primary_contact: boolean;
  can_pickup: boolean;
  parent_full_name?: string;
  parent_phone?: string | null;
  parent_email?: string;
}

export interface Student {
  id: string;
  tenant_id: string;
  full_name: string;
  dob: string;
  gender?: string | null;
  avatar_url?: string | null;
  current_class_id?: string | null;
  class_name?: string;
  status: StudentStatus;
  enrollment_date?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  parents?: StudentParent[];
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Có mặt",
  absent: "Vắng",
  late: "Đi muộn",
  excused: "Nghỉ phép",
};

export interface Attendance {
  id: string;
  tenant_id: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatus;
  check_in_time?: string | null;
  check_out_time?: string | null;
  picked_up_by?: string | null;
  note?: string | null;
  recorded_by?: string | null;
  student_full_name?: string;
  class_name?: string;
  created_at: string;
  updated_at: string;
}

export interface DailyJournal {
  id: string;
  tenant_id: string;
  class_id: string;
  student_id?: string | null;
  date: string;
  content: string;
  photo_urls: string[];
  created_by: string;
  author_full_name?: string;
  class_name?: string;
  created_at: string;
  updated_at: string;
}

export type AnnouncementAudience = "school" | "grade" | "class";

export const ANNOUNCEMENT_AUDIENCE_LABELS: Record<AnnouncementAudience, string> = {
  school: "Toàn trường",
  grade: "Một khối",
  class: "Một lớp",
};

export interface Announcement {
  id: string;
  tenant_id: string;
  title: string;
  content: string;
  audience: AnnouncementAudience;
  grade_id?: string | null;
  class_id?: string | null;
  is_urgent: boolean;
  created_by: string;
  author_full_name?: string;
  published_at?: string | null;
  created_at: string;
}

/**
 * Nội dung dashboard/summary thay đổi theo vai trò (SRS muc M17 / ARCHITECTURE muc 5.2).
 * Vì backend chưa cố định hình dạng chi tiết, các trường đều optional và UI
 * tự chọn hiển thị dựa trên vai trò người dùng đang đăng nhập kết hợp dữ liệu có sẵn.
 */
export interface DashboardSummary {
  total_students?: number;
  total_classes?: number;
  total_staff?: number;
  today_attendance?: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
  };
  my_classes?: Array<{
    class_id: string;
    class_name: string;
    student_count: number;
    attendance_taken?: boolean;
    present_today?: number;
  }>;
  my_children?: Array<{
    student_id: string;
    full_name: string;
    class_name?: string;
    avatar_url?: string | null;
    today_status?: AttendanceStatus | null;
  }>;
  recent_announcements?: Announcement[];
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    page_size: number;
    total: number;
  };
}
