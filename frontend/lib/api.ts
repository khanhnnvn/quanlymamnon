// Các hàm gọi API theo từng resource, dựng trên lib/api-client.ts.
// Mỗi hàm trả về dữ liệu đã "unwrap" khỏi { data: ... } cho gọn ở nơi gọi.

import {
  apiRequest,
  clearAuth,
  writeAuth,
  writeStoredUser,
  type ApiScope,
} from "./api-client";
import type {
  Announcement,
  AnnouncementAudience,
  Attendance,
  AttendanceStatus,
  DailyJournal,
  DashboardSummary,
  Grade,
  Paginated,
  RoleCode,
  SchoolClass,
  SchoolYear,
  Student,
  Tenant,
  User,
} from "./types";

// ---------------------------------------------------------------------------
// System (Super Admin)
// ---------------------------------------------------------------------------

export const systemApi = {
  async login(email: string, password: string) {
    const res = await apiRequest<{ data: { access_token: string; refresh_token: string; user: User } }>(
      "system",
      "/auth/login",
      { method: "POST", body: { email, password }, skipAuth: true, skipRefresh: true }
    );
    writeAuth("system", {
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
    });
    writeStoredUser("system", res.data.user);
    return res.data.user;
  },

  logout() {
    clearAuth("system");
  },

  async listTenants(): Promise<Tenant[]> {
    const res = await apiRequest<{ data: Tenant[] } | Paginated<Tenant>>("system", "/tenants");
    return res.data;
  },

  async getTenant(id: string): Promise<Tenant> {
    const res = await apiRequest<{ data: Tenant }>("system", `/tenants/${id}`);
    return res.data;
  },

  async createTenant(payload: {
    name: string;
    slug?: string;
    address?: string;
    phone?: string;
    email?: string;
    plan?: string;
    admin_full_name: string;
    admin_email: string;
    admin_password: string;
  }): Promise<Tenant> {
    const res = await apiRequest<{ data: Tenant }>("system", "/tenants", {
      method: "POST",
      body: payload,
    });
    return res.data;
  },

  async updateTenant(
    id: string,
    payload: Partial<Pick<Tenant, "name" | "address" | "phone" | "email" | "plan" | "status">>
  ): Promise<Tenant> {
    const res = await apiRequest<{ data: Tenant }>("system", `/tenants/${id}`, {
      method: "PATCH",
      body: payload,
    });
    return res.data;
  },
};

// ---------------------------------------------------------------------------
// Auth theo tenant
// ---------------------------------------------------------------------------

export const authApi = {
  async login(tenant: string, email: string, password: string) {
    const scope: ApiScope = { tenant };
    const res = await apiRequest<{ data: { access_token: string; refresh_token: string; user: User } }>(
      scope,
      "/auth/login",
      { method: "POST", body: { email, password }, skipAuth: true, skipRefresh: true }
    );
    writeAuth(scope, {
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token,
    });
    writeStoredUser(scope, res.data.user);
    return res.data.user;
  },

  async me(tenant: string): Promise<User & { roles: RoleCode[] }> {
    const res = await apiRequest<{ data: User & { roles: RoleCode[] } }>(
      { tenant },
      "/auth/me"
    );
    writeStoredUser({ tenant }, res.data);
    return res.data;
  },

  logout(tenant: string) {
    clearAuth({ tenant });
  },
};

// ---------------------------------------------------------------------------
// Năm học / Khối / Lớp
// ---------------------------------------------------------------------------

export const schoolYearsApi = {
  async list(tenant: string): Promise<SchoolYear[]> {
    const res = await apiRequest<{ data: SchoolYear[] }>({ tenant }, "/school-years");
    return res.data;
  },
  async create(tenant: string, payload: Omit<SchoolYear, "id" | "tenant_id">): Promise<SchoolYear> {
    const res = await apiRequest<{ data: SchoolYear }>({ tenant }, "/school-years", {
      method: "POST",
      body: payload,
    });
    return res.data;
  },
  async update(tenant: string, id: string, payload: Partial<SchoolYear>): Promise<SchoolYear> {
    const res = await apiRequest<{ data: SchoolYear }>({ tenant }, `/school-years/${id}`, {
      method: "PATCH",
      body: payload,
    });
    return res.data;
  },
};

export const gradesApi = {
  async list(tenant: string): Promise<Grade[]> {
    const res = await apiRequest<{ data: Grade[] }>({ tenant }, "/grades");
    return res.data;
  },
  async create(tenant: string, payload: Omit<Grade, "id" | "tenant_id">): Promise<Grade> {
    const res = await apiRequest<{ data: Grade }>({ tenant }, "/grades", {
      method: "POST",
      body: payload,
    });
    return res.data;
  },
};

export const classesApi = {
  async list(tenant: string, schoolYearId?: string): Promise<SchoolClass[]> {
    const qs = schoolYearId ? `?school_year_id=${encodeURIComponent(schoolYearId)}` : "";
    const res = await apiRequest<{ data: SchoolClass[] } | Paginated<SchoolClass>>(
      { tenant },
      `/classes${qs}`
    );
    return res.data;
  },
  async create(
    tenant: string,
    payload: { name: string; grade_id: string; school_year_id: string; capacity: number }
  ): Promise<SchoolClass> {
    const res = await apiRequest<{ data: SchoolClass }>({ tenant }, "/classes", {
      method: "POST",
      body: payload,
    });
    return res.data;
  },
  async update(tenant: string, id: string, payload: Partial<SchoolClass>): Promise<SchoolClass> {
    const res = await apiRequest<{ data: SchoolClass }>({ tenant }, `/classes/${id}`, {
      method: "PATCH",
      body: payload,
    });
    return res.data;
  },
  async assignTeacher(
    tenant: string,
    classId: string,
    payload: { user_id: string; role_in_class: "main" | "assistant" }
  ): Promise<void> {
    await apiRequest({ tenant }, `/classes/${classId}/teachers`, {
      method: "POST",
      body: payload,
    });
  },
};

// ---------------------------------------------------------------------------
// Học sinh
// ---------------------------------------------------------------------------

export const studentsApi = {
  async list(tenant: string, params?: { class_id?: string; q?: string }): Promise<Student[]> {
    const query = new URLSearchParams();
    if (params?.class_id) query.set("class_id", params.class_id);
    if (params?.q) query.set("q", params.q);
    const qs = query.toString();
    const res = await apiRequest<{ data: Student[] } | Paginated<Student>>(
      { tenant },
      `/students${qs ? `?${qs}` : ""}`
    );
    return res.data;
  },
  async get(tenant: string, id: string): Promise<Student> {
    const res = await apiRequest<{ data: Student }>({ tenant }, `/students/${id}`);
    return res.data;
  },
  async create(
    tenant: string,
    payload: {
      full_name: string;
      dob: string;
      gender?: string;
      current_class_id?: string | null;
      enrollment_date?: string;
      note?: string;
      status?: string;
    }
  ): Promise<Student> {
    const res = await apiRequest<{ data: Student }>({ tenant }, "/students", {
      method: "POST",
      body: payload,
    });
    return res.data;
  },
  async update(tenant: string, id: string, payload: Partial<Student>): Promise<Student> {
    const res = await apiRequest<{ data: Student }>({ tenant }, `/students/${id}`, {
      method: "PATCH",
      body: payload,
    });
    return res.data;
  },
  // Backend LinkParentInput (docs/ARCHITECTURE.md mục 5.2) yêu cầu
  // parent_user_id của một tài khoản đã tồn tại — nó không tự tạo tài
  // khoản phụ huynh. Nếu phụ huynh chưa có tài khoản, gọi
  // usersApi.create({..., roles:["PARENT"]}) trước để lấy id rồi mới gọi
  // hàm này (xem LinkParentModal trong students/[id]/page.tsx).
  async linkParent(
    tenant: string,
    studentId: string,
    payload: {
      parent_user_id: string;
      relationship?: string;
      is_primary_contact?: boolean;
      can_pickup?: boolean;
    }
  ): Promise<{ student_id: string; parent_user_id: string }> {
    const res = await apiRequest<{ data: { student_id: string; parent_user_id: string } }>(
      { tenant },
      `/students/${studentId}/parents`,
      { method: "POST", body: payload }
    );
    return res.data;
  },
};

// ---------------------------------------------------------------------------
// Điểm danh
// ---------------------------------------------------------------------------

export const attendanceApi = {
  async listByClassDate(tenant: string, classId: string, date: string): Promise<Attendance[]> {
    const res = await apiRequest<{ data: Attendance[] }>(
      { tenant },
      `/attendance?class_id=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`
    );
    return res.data;
  },
  async record(
    tenant: string,
    payload: {
      student_id: string;
      class_id: string;
      date: string;
      status: AttendanceStatus;
      check_in_time?: string;
      check_out_time?: string;
      picked_up_by?: string;
      note?: string;
    }
  ): Promise<Attendance> {
    const res = await apiRequest<{ data: Attendance }>({ tenant }, "/attendance", {
      method: "POST",
      body: payload,
    });
    return res.data;
  },
  async historyByStudent(tenant: string, studentId: string): Promise<Attendance[]> {
    const res = await apiRequest<{ data: Attendance[] }>(
      { tenant },
      `/attendance/student/${studentId}`
    );
    return res.data;
  },
};

// ---------------------------------------------------------------------------
// Nhật ký lớp học
// ---------------------------------------------------------------------------

export const journalApi = {
  async listByClassDate(tenant: string, classId: string, date: string): Promise<DailyJournal[]> {
    const res = await apiRequest<{ data: DailyJournal[] }>(
      { tenant },
      `/journals?class_id=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`
    );
    return res.data;
  },
  async create(
    tenant: string,
    payload: {
      class_id: string;
      student_id?: string | null;
      date: string;
      content: string;
      photo_urls: string[];
    }
  ): Promise<DailyJournal> {
    const res = await apiRequest<{ data: DailyJournal }>({ tenant }, "/journals", {
      method: "POST",
      body: payload,
    });
    return res.data;
  },
  async listByStudent(tenant: string, studentId: string): Promise<DailyJournal[]> {
    const res = await apiRequest<{ data: DailyJournal[] }>(
      { tenant },
      `/journals/student/${studentId}`
    );
    return res.data;
  },
};

// ---------------------------------------------------------------------------
// Thông báo
// ---------------------------------------------------------------------------

export const announcementsApi = {
  async list(tenant: string): Promise<Announcement[]> {
    const res = await apiRequest<{ data: Announcement[] } | Paginated<Announcement>>(
      { tenant },
      "/announcements"
    );
    return res.data;
  },
  async create(
    tenant: string,
    payload: {
      title: string;
      content: string;
      audience: AnnouncementAudience;
      grade_id?: string | null;
      class_id?: string | null;
      is_urgent?: boolean;
    }
  ): Promise<Announcement> {
    const res = await apiRequest<{ data: Announcement }>({ tenant }, "/announcements", {
      method: "POST",
      body: payload,
    });
    return res.data;
  },
};

// ---------------------------------------------------------------------------
// Nhân sự (users theo tenant)
// ---------------------------------------------------------------------------

export const usersApi = {
  async list(tenant: string): Promise<User[]> {
    const res = await apiRequest<{ data: User[] } | Paginated<User>>({ tenant }, "/users");
    return res.data;
  },
  async create(
    tenant: string,
    payload: {
      full_name: string;
      email: string;
      phone?: string;
      password: string;
      roles: RoleCode[];
      status?: string;
    }
  ): Promise<User> {
    // Backend CreateUserInput đọc key JSON "role_codes" (docs/ARCHITECTURE.md
    // mục 5.2), không phải "roles" — đổi tên khi gửi đi, giữ "roles" ở tham
    // số hàm cho nhất quán với phần còn lại của app.
    const { roles, ...rest } = payload;
    const res = await apiRequest<{ data: User }>({ tenant }, "/users", {
      method: "POST",
      body: { ...rest, role_codes: roles },
    });
    return res.data;
  },
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export const dashboardApi = {
  async summary(tenant: string): Promise<DashboardSummary> {
    const res = await apiRequest<{ data: DashboardSummary }>({ tenant }, "/dashboard/summary");
    return res.data;
  },
};
