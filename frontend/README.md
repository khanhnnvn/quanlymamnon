# Mầm Non Số — Frontend

Frontend Next.js (App Router, TypeScript, TailwindCSS) cho hệ thống quản lý trường mầm non đa-tenant.
Xem hợp đồng kỹ thuật đầy đủ tại `../docs/SRS.md` và `../docs/ARCHITECTURE.md`.

## Yêu cầu

- Node.js 20+ (đã kiểm thử với Node 26)
- Backend Go API chạy ở `http://127.0.0.1:8097` (mặc định, đổi qua biến `API_INTERNAL_URL`)

## Cài đặt

```bash
npm install
```

Tạo file môi trường (không commit) từ mẫu:

```bash
cp .env.example .env.local
```

## Chạy ở chế độ phát triển

```bash
npm run dev
```

Mặc định chạy ở `http://localhost:3000`. Mọi lời gọi `/api/v1/...` từ trình duyệt sẽ được
`next.config.js` rewrite tới backend tại `API_INTERNAL_URL` (mặc định `http://127.0.0.1:8097`).
Nếu backend chưa chạy, các trang vẫn hiển thị đầy đủ với trạng thái loading/lỗi/rỗng hợp lý
(không crash, không cần backend để `next dev`/`next build` hoạt động).

## Build & chạy production (đúng theo triển khai thật, cổng 3312)

```bash
npm run build
npm start -- -p 3312
```

Nginx/Cloudflare Tunnel trỏ vào cổng `3312` theo `docs/ARCHITECTURE.md` mục 1.

## Cấu trúc thư mục chính

```
app/
  page.tsx                     # Landing: giới thiệu + cổng Super Admin + nhập mã trường
  admin/                       # Super Admin: đăng nhập, quản lý danh sách trường (tenant)
  [tenant]/
    login/page.tsx             # Đăng nhập theo trường
    (app)/layout.tsx           # Sidebar điều hướng theo vai trò, guard đăng nhập
    (app)/dashboard/           # Tổng quan theo vai trò (admin/giáo viên/phụ huynh)
    (app)/classes/             # Lớp học, phân công giáo viên
    (app)/students/            # Hồ sơ học sinh, liên kết phụ huynh
    (app)/attendance/          # Điểm danh theo lớp/ngày, lịch sử theo học sinh
    (app)/journal/             # Nhật ký lớp học hằng ngày
    (app)/announcements/       # Thông báo theo phạm vi trường/khối/lớp
    (app)/staff/                # Quản lý nhân sự (chỉ Admin/Vice)
lib/
  api-client.ts                # fetch wrapper: gắn Authorization, tự refresh khi 401
  api.ts                       # Hàm gọi API theo từng resource
  auth-context.tsx             # SystemAuthProvider (Super Admin) & TenantAuthProvider
  types.ts                     # Type khớp với lược đồ CSDL ở ARCHITECTURE.md
components/ui/                 # Design system dùng chung (Button, Card, Input, Table, Modal...)
```

## Ghi chú thiết kế

- Toàn bộ dữ liệu được lấy ở client-side (`useEffect`), có đầy đủ trạng thái loading/error/empty,
  nên `next build` không phụ thuộc backend đang chạy.
- Token đăng nhập lưu trong `localStorage`, tách riêng theo scope Super Admin (`mn_auth_system`)
  và theo từng trường (`mn_auth_<slug>`). Gọi API 401 sẽ tự động refresh token và thử lại 1 lần.
- Bảng màu ấm áp (cam san hô, vàng nắng, xanh bạc hà) và bo góc mềm mại phù hợp trường mầm non,
  ưu tiên trải nghiệm mobile cho các trang phụ huynh hay dùng (dashboard, nhật ký, lịch sử điểm danh).
