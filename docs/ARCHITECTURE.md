# Kiến trúc kỹ thuật — Hệ thống Quản lý Trường Mầm non

Tài liệu này là hợp đồng kỹ thuật (contract) giữa backend và frontend. Mọi thay đổi API/schema phải cập nhật file này trước.

## 1. Tổng quan hạ tầng (triển khai trên máy chủ hiện tại, không Docker)

```
Internet ──HTTPS──> Cloudflare (Tunnel: mamnon.vietsoftware.vn)
                        │
                        ▼
              cloudflared (localhost, launchd)
                        │  http://127.0.0.1:8080  (Host: mamnon.vietsoftware.vn)
                        ▼
                     Nginx  (vhost theo server_name, đã có sẵn trên máy)
                        │  proxy_pass http://127.0.0.1:3312
                        ▼
              Next.js frontend (launchd, port 3312)
                        │  rewrites /api/* → http://127.0.0.1:8097
                        ▼
              Go backend API (launchd, port 8097)
                        │
                        ▼
              PostgreSQL (role: mamnon / db: quanlymamnon, port 5432, đã chạy sẵn)
```

Lý do chọn Next.js làm tầng vào duy nhất: trình duyệt gọi API cùng-origin (`/api/...`) nên không cần CORS, và Nginx/Cloudflare chỉ cần trỏ tới một cổng.

Cổng đã chọn (kiểm tra không trùng với các site khác trên máy): backend `8097`, frontend `3312`.

## 2. Mô hình đa-tenant

- URL frontend: `/{slug}/...` với `slug` dạng `mamnon_[a-z0-9_]+`.
- URL API: `/api/v1/{slug}/...` cho route theo tenant; `/api/v1/system/...` cho Super Admin (không có slug).
- Middleware `TenantResolver` (Gin): đọc `:slug` từ path → `SELECT * FROM tenants WHERE slug = $1 AND status = 'active'` (cache in-memory TTL ngắn) → nếu không thấy trả 404; set `tenant_id` vào `gin.Context`.
- Middleware `AuthRequired`: parse JWT từ header `Authorization: Bearer <token>`; với route theo tenant, bắt buộc `claims.tenant_id == tenant_id trong context` (nếu khác → 403); với route `/system/*`, bắt buộc `claims.tenant_id == null` và `claims.role == SUPER_ADMIN`.
- Middleware `RequireRole(codes...)`: kiểm tra vai trò người dùng (một user có thể có nhiều role) nằm trong danh sách cho phép.
- **Không có tầng nào được tin dữ liệu tenant từ body/query của client** — tenant luôn suy ra từ URL + JWT.

## 3. Vai trò hệ thống (bảng `roles`, cố định seed sẵn — cột `code`)

| code | Tên hiển thị | Phạm vi |
|---|---|---|
| SUPER_ADMIN | Quản trị hệ thống | Toàn hệ thống, không thuộc tenant |
| SCHOOL_ADMIN | Hiệu trưởng | 1 tenant |
| VICE_ADMIN | Hiệu phó | 1 tenant |
| HEAD_TEACHER | Tổ trưởng chuyên môn | 1 tenant, theo khối |
| TEACHER | Giáo viên chính | 1 tenant, theo lớp |
| ASSISTANT_TEACHER | Giáo viên phụ/Trợ giảng | 1 tenant, theo lớp |
| ACCOUNTANT | Kế toán | 1 tenant |
| NURSE | Y tế | 1 tenant |
| COOK | Cấp dưỡng | 1 tenant |
| SECURITY | Bảo vệ | 1 tenant |
| OFFICE_STAFF | Văn thư/Nhân viên khác | 1 tenant |
| PARENT | Phụ huynh | 1 tenant, theo học sinh liên kết |

## 4. Lược đồ CSDL (PostgreSQL, shared schema + `tenant_id`)

Quy ước chung: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at`/`updated_at TIMESTAMPTZ DEFAULT now()`, xóa mềm bằng `deleted_at TIMESTAMPTZ NULL` cho các bảng nghiệp vụ chính.

### 4.1 Bảng lõi (cài đặt trong v1)

```sql
tenants(
  id, slug UNIQUE NOT NULL, name, address, phone, email,
  logo_url, plan, status ENUM('pending','active','suspended','archived'),
  settings JSONB DEFAULT '{}', created_at, updated_at
)

users(
  id, tenant_id NULL REFERENCES tenants,  -- NULL cho super admin
  email UNIQUE per-tenant, phone, password_hash, full_name, avatar_url,
  status ENUM('active','disabled'), failed_login_count, locked_until,
  created_at, updated_at
)
-- UNIQUE(tenant_id, email)

roles(id, code UNIQUE, name)   -- seed tĩnh, xem mục 3

user_roles(id, user_id REFERENCES users, role_id REFERENCES roles, tenant_id)

school_years(id, tenant_id, name, start_date, end_date, is_current BOOL)

grades(id, tenant_id, name, sort_order)   -- Nhà trẻ/Mầm/Chồi/Lá, tùy biến theo trường

classes(
  id, tenant_id, school_year_id REFERENCES school_years, grade_id REFERENCES grades,
  name, capacity, created_at, updated_at
)

class_teachers(
  id, tenant_id, class_id REFERENCES classes, user_id REFERENCES users,
  role_in_class ENUM('main','assistant')
)

students(
  id, tenant_id, full_name, dob DATE, gender, avatar_url,
  current_class_id NULL REFERENCES classes,
  status ENUM('enrolled','on_leave','withdrawn'),
  enrollment_date, note, created_at, updated_at, deleted_at
)

student_parents(
  id, tenant_id, student_id REFERENCES students, parent_user_id REFERENCES users,
  relationship, is_primary_contact BOOL, can_pickup BOOL
)

attendance(
  id, tenant_id, student_id REFERENCES students, class_id REFERENCES classes,
  date DATE, status ENUM('present','absent','late','excused'),
  check_in_time TIMESTAMPTZ NULL, check_out_time TIMESTAMPTZ NULL,
  picked_up_by TEXT NULL, note TEXT, recorded_by REFERENCES users,
  created_at, updated_at
)
-- UNIQUE(tenant_id, student_id, date)

daily_journals(
  id, tenant_id, class_id REFERENCES classes, student_id NULL REFERENCES students,
  date DATE, content TEXT, photo_urls JSONB DEFAULT '[]',
  created_by REFERENCES users, created_at, updated_at
)

announcements(
  id, tenant_id, title, content, audience ENUM('school','grade','class'),
  grade_id NULL, class_id NULL, is_urgent BOOL DEFAULT false,
  created_by REFERENCES users, published_at, created_at
)

audit_logs(
  id, tenant_id NULL, user_id NULL, action, entity, entity_id,
  meta JSONB DEFAULT '{}', created_at
)
```

### 4.2 Bảng phase 2+ (đã có trong file migration nhưng chưa có API/UI đầy đủ)

`lesson_plans`, `development_assessments`, `health_records`, `vaccination_records`, `medical_incidents`, `menus`, `leave_requests`, `conversations`/`messages`, `fee_items`, `invoices`, `payments`, `staff_profiles`, `staff_attendance`, `extracurricular_activities`, `activity_enrollments`, `inventory_items`.

Các bảng này được tạo sẵn ở migration `0002_phase2_schema.sql` để không phải sửa schema về sau, nhưng handler/route/UI sẽ bổ sung ở các đợt tiếp theo.

## 5. API contract (v1 — đã cài đặt)

Base path: `/api/v1`. Response JSON chuẩn:
```json
// success
{ "data": ... }
// error
{ "error": { "code": "STRING_CODE", "message": "..." } }
```
Phân trang: query `?page=1&page_size=20`, response bọc thêm `"meta": {"page":1,"page_size":20,"total":123}`.

### 5.1 System (Super Admin, không có slug)
| Method | Path | Mô tả |
|---|---|---|
| POST | `/system/auth/login` | Đăng nhập Super Admin |
| GET | `/system/tenants` | Danh sách trường |
| POST | `/system/tenants` | Tạo trường mới (sinh slug, tạo user Hiệu trưởng đầu tiên) |
| GET | `/system/tenants/:id` | Chi tiết trường |
| PATCH | `/system/tenants/:id` | Cập nhật / đổi trạng thái (active/suspended/archived) |

### 5.2 Theo tenant: `/{slug}/...`
| Method | Path | Vai trò | Mô tả |
|---|---|---|---|
| POST | `/{slug}/auth/login` | ai cũng gọi được | Đăng nhập |
| GET | `/{slug}/auth/me` | đã đăng nhập | Thông tin user + roles hiện tại |
| POST | `/{slug}/auth/refresh` | đã đăng nhập | Làm mới access token |
| GET/POST | `/{slug}/school-years` | Admin/Vice | CRUD năm học |
| PATCH | `/{slug}/school-years/:id` | Admin/Vice | — |
| GET/POST | `/{slug}/grades` | Admin/Vice | CRUD khối |
| GET/POST | `/{slug}/classes` | Admin/Vice (đọc: HeadTeacher/Teacher lớp mình) | CRUD lớp + phân công GV |
| PATCH | `/{slug}/classes/:id` | Admin/Vice | Sửa tên/khối/sức chứa lớp |
| POST | `/{slug}/classes/:id/teachers` | Admin/Vice | Gán giáo viên chính/phụ |
| GET/POST | `/{slug}/students` | Admin/Vice/Teacher(lớp mình) | CRUD học sinh |
| GET | `/{slug}/students/:id` | + Parent (con mình) | Chi tiết học sinh |
| PATCH | `/{slug}/students/:id` | Admin/Vice/Teacher(lớp mình hiện tại) | Sửa hồ sơ học sinh |
| POST | `/{slug}/students/:id/parents` | Admin/Vice | Liên kết phụ huynh với học sinh — nhận `parent_user_id` của một tài khoản **đã tồn tại** (role `PARENT`); không tự tạo tài khoản. Để thêm phụ huynh mới: gọi `POST /{slug}/users` với `role_codes: ["PARENT"]` trước, rồi lấy `id` trả về gọi endpoint này. |
| GET/POST | `/{slug}/users` | Admin/Vice | Quản lý người dùng (GV/nhân viên/phụ huynh), gán vai trò qua `role_codes` |
| GET/POST | `/{slug}/attendance` | Teacher/Assistant (lớp mình), Admin xem tất cả | Điểm danh theo `class_id` + `date`. `POST` là **upsert** theo khóa duy nhất `(tenant_id, student_id, date)` — gọi lại `POST` với cùng học sinh/ngày để sửa trạng thái, không có route `PATCH` riêng. |
| GET | `/{slug}/attendance/student/:id` | Teacher liên quan + Parent (con mình) + Admin/Vice | Lịch sử điểm danh 1 học sinh |
| GET/POST | `/{slug}/journals` | Teacher/Assistant (lớp mình, ghi); + Admin/Vice (đọc, giám sát toàn trường) | Nhật ký lớp |
| GET | `/{slug}/journals/student/:id` | Parent (con mình) + GV liên quan + Admin/Vice | Nhật ký theo học sinh |
| GET/POST | `/{slug}/announcements` | Admin/Vice (đọc+ghi mọi phạm vi); Teacher/Assistant (đọc trường+khối+lớp mình, ghi lớp mình); Parent (chỉ đọc: trường + khối/lớp của con) | Thông báo |
| GET | `/{slug}/dashboard/summary` | tất cả (nội dung khác nhau theo role) | Số liệu tổng quan theo vai trò |

Toàn bộ handler ghi (`POST/PATCH/DELETE`) trên `students`, `attendance`, `journals`, `users` phải ghi 1 dòng vào `audit_logs`.

## 6. Xác thực (JWT)

- Access token: HS256, TTL 30 phút, payload `{sub: user_id, tenant_id, roles: [code...], exp}`.
- Refresh token: TTL 14 ngày, lưu hash trong bảng `users` (cột `refresh_token_hash`) hoặc bảng riêng `refresh_tokens` — v1 dùng cột trên `users` cho đơn giản.
- Mật khẩu: bcrypt cost 12.
- Secret ký JWT lấy từ biến môi trường `JWT_SECRET`, **không hard-code, không commit**.

## 7. Cấu trúc thư mục

```
backend/
  cmd/api/main.go
  internal/
    config/        # đọc env
    db/             # kết nối pg + migration runner
    middleware/     # tenant resolver, auth, rbac, logging
    auth/           # jwt, password hashing
    tenant/  user/  school/  student/  attendance/  journal/  announcement/  dashboard/
      handler.go  service.go  repository.go  model.go
  migrations/
    0001_core_schema.sql
    0002_phase2_schema.sql
    0003_seed_roles.sql
  go.mod

frontend/
  app/
    page.tsx                    # landing
    admin/...                   # Super Admin (đăng nhập, danh sách trường)
    [tenant]/
      login/page.tsx
      (app)/layout.tsx          # layout có sidebar theo role, guard đăng nhập
      (app)/dashboard/page.tsx
      (app)/classes/...
      (app)/students/...
      (app)/attendance/...
      (app)/journal/...
      (app)/announcements/...
      (app)/staff/...
  lib/
    api-client.ts                # fetch wrapper, tự gắn Authorization, xử lý refresh
    auth-context.tsx
    types.ts                     # mirror các model backend
  components/ui/...              # design system dùng chung
  next.config.js                 # rewrites /api/* -> backend
```

## 8. Biến môi trường

Backend (`backend/.env`, không commit — chỉ commit `.env.example`):
```
PORT=8097
DATABASE_URL=postgres://mamnon:__SET_IN_ENV__@127.0.0.1:5432/quanlymamnon?sslmode=disable
JWT_SECRET=__SET_IN_ENV__
ENV=production
```

Frontend (`frontend/.env.production`):
```
API_INTERNAL_URL=http://127.0.0.1:8097
```
(Next.js rewrites dùng biến này ở server-side; trình duyệt luôn gọi `/api/...` same-origin.)

## 9. Quy ước lỗi & mã trạng thái
`400` dữ liệu không hợp lệ · `401` chưa đăng nhập/token hết hạn · `403` không đủ quyền hoặc sai tenant · `404` không tìm thấy · `409` xung đột (ví dụ trùng điểm danh) · `500` lỗi hệ thống (log server, không lộ chi tiết cho client).
