# Backend — Hệ thống Quản lý Trường Mầm non

Go (Gin) REST API. Xem `docs/ARCHITECTURE.md` ở thư mục gốc repo để biết đầy
đủ schema/API contract.

## Yêu cầu

- Go 1.26+
- PostgreSQL đang chạy, đã tạo sẵn database/role (xem `DATABASE_URL`)

## Cấu hình

Sao chép `.env.example` thành `.env` rồi điền giá trị thật (file `.env`
không được commit):

```
cp .env.example .env
```

Biến môi trường:

| Biến | Mô tả |
|---|---|
| `PORT` | Cổng HTTP backend lắng nghe (mặc định `8097`) |
| `DATABASE_URL` | Chuỗi kết nối PostgreSQL |
| `JWT_SECRET` | Khóa ký JWT (bắt buộc, không hard-code) |
| `ENV` | `development` hoặc `production` |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | Nếu đặt và chưa có Super Admin nào trong DB, backend tự tạo tài khoản Super Admin đầu tiên khi khởi động (chỉ chạy 1 lần, không phải API) |
| `ALLOWED_ORIGIN` | Origin được phép CORS (mặc định `*`, dùng cho dev) |

## Chạy dev

```
go run ./cmd/api
```

Migration SQL trong `migrations/` tự động chạy khi khởi động (idempotent,
theo dõi qua bảng `schema_migrations`).

Kiểm tra health check:

```
curl http://127.0.0.1:8097/healthz
```

## Build production

```
go build -o bin/api ./cmd/api
```

Chạy binary đã build (đọc `.env` cùng thư mục làm việc nếu có, hoặc dùng
biến môi trường thật do launchd cấp):

```
./bin/api
```

## Cấu trúc thư mục

```
cmd/api/main.go        # entrypoint, wiring router + middleware
internal/
  config/               # đọc biến môi trường (.env qua godotenv)
  db/                    # kết nối pg + migration runner (go:embed)
  middleware/            # TenantResolver, AuthRequired, RequireRole, CORS, logging
  auth/                  # JWT issue/parse, bcrypt password hashing
  response/              # response envelope chuẩn {"data"|"error"}
  pagination/            # parse page/page_size
  audit/                 # ghi audit_logs
  scope/                 # helper RBAC dùng chung (lớp mình / con mình)
  tenant/  user/  school/  student/  attendance/  journal/  announcement/  dashboard/
    handler.go  service.go  repository.go  model.go
migrations/
  0001_core_schema.sql
  0002_phase2_schema.sql
  0003_seed_roles.sql
  embed.go              # go:embed *.sql — cần một file .go trong migrations/ để nhúng
```

## Ghi chú triển khai / sai lệch so với ARCHITECTURE.md

- `migrations/embed.go`: `go:embed` chỉ nhúng được thư mục con của chính file
  .go chứa directive, nên cần một file .go nhỏ ngay trong `migrations/` để
  nhúng các file `.sql` vào binary. Không có file `.sql` nào bị đổi nội dung.
- RBAC được cài đặt bám sát đúng cột "Vai trò" ở mục 5.2 ARCHITECTURE.md
  (nguồn sự thật). Một số điểm SRS.md mục 4 mô tả rộng hơn (ví dụ Hiệu
  trưởng "xem tất cả" nhật ký lớp, Bảo vệ "ghi cổng trường" điểm danh) nhưng
  không có trong bảng endpoint chi tiết của ARCHITECTURE.md — các quyền đó
  **không** được thêm vào để tránh tự sáng tạo ngoài hợp đồng; xem ghi chú
  chi tiết trong báo cáo bàn giao.
- Không có bảng ánh xạ "Tổ trưởng chuyên môn phụ trách khối nào" trong mục
  4.1, nên `HEAD_TEACHER` được cấp quyền đọc toàn tenant (thay vì lọc theo
  khối) cho các endpoint mà vai trò này xuất hiện.
- `students`, `grades`, `classes` chỉ có method GET/POST theo đúng bảng mục
  5.2 (không có PATCH/DELETE) dù mô tả ghi "CRUD" — cột Method trong bảng
  được ưu tiên vì đó là phần đặc tả method/path chính xác.
