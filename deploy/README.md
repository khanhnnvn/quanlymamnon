# Triển khai production (máy chủ hiện tại — macOS, không Docker)

Kiến trúc chạy thật, xem sơ đồ đầy đủ ở [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) mục 1.

```
Cloudflare (mamnon.vietsoftware.vn) → cloudflared tunnel "mamnon" → Nginx :8080
  → Next.js :3312 (rewrites /api/* → Go API :8097) → PostgreSQL (role mamnon / db quanlymamnon)
```

## Các thành phần đã cấu hình trên máy này

| Thành phần | Vị trí | Ghi chú |
|---|---|---|
| DB Postgres | role `mamnon`, db `quanlymamnon` (đã chạy sẵn qua `brew services`, không cần cấu hình thêm) | mật khẩu trong `backend/.env` (không commit) |
| Nginx vhost | `/Users/sysadmin/source/sysadmin/conf/mamnon.conf` (symlink vào `/opt/homebrew/etc/nginx/servers/`) | proxy `mamnon.vietsoftware.vn` (port 8080) → `127.0.0.1:3312` |
| Cloudflare Tunnel | `~/.cloudflared/mamnon.yml`, tunnel id `076de24d-4c0c-44c1-8587-d904d96fa0bf` | DNS CNAME `mamnon.vietsoftware.vn` → `<tunnel-id>.cfargotunnel.com` (proxied) đã tạo qua Cloudflare API |
| launchd — cloudflared | `~/Library/LaunchAgents/com.mamnon.cloudflared.plist` | `RunAtLoad` + `KeepAlive` → tự chạy khi khởi động máy, tự phục hồi khi crash |
| launchd — backend | `~/Library/LaunchAgents/com.mamnon.backend.plist` | chạy `backend/bin/api`, đọc cấu hình từ `backend/.env` (qua godotenv) |
| launchd — frontend | `~/Library/LaunchAgents/com.mamnon.frontend.plist` | chạy `next start -p 3312` bằng `node` trực tiếp vào `node_modules/next/dist/bin/next` |

Log: `/opt/homebrew/var/log/mamnon-backend.log`, `/opt/homebrew/var/log/mamnon-frontend.log`, `/opt/homebrew/var/log/cloudflared-mamnon.log`.

## Bí mật (không nằm trong git)

- `backend/.env` — `DATABASE_URL`, `JWT_SECRET`, `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` (chỉ dùng lần đầu khi chưa có Super Admin nào).
- Bản sao mật khẩu Super Admin đầu tiên: `/Users/sysadmin/.mamnon_secrets/super_admin.txt` (chmod 600, ngoài thư mục repo).

## Cách deploy khi có code mới

```bash
cd /Users/sysadmin/source/vsisanpham/quanlymamnon

# Backend
cd backend
go build -o bin/api ./cmd/api
launchctl unload ~/Library/LaunchAgents/com.mamnon.backend.plist
launchctl load -w ~/Library/LaunchAgents/com.mamnon.backend.plist

# Frontend
cd ../frontend
npm install   # nếu có thay đổi dependency
npm run build
launchctl unload ~/Library/LaunchAgents/com.mamnon.frontend.plist
launchctl load -w ~/Library/LaunchAgents/com.mamnon.frontend.plist
```

Migration DB chạy tự động mỗi khi backend khởi động (idempotent).

## Kiểm tra sau khi restart máy

```bash
launchctl list | grep mamnon        # cả 3 job phải có mặt
curl -I https://mamnon.vietsoftware.vn/
```

## Thêm một trường mầm non mới

Đăng nhập Super Admin tại `https://mamnon.vietsoftware.vn/admin/login`, vào "Danh sách trường" → tạo trường mới (sinh slug `mamnon_<ten>` tự động, có thể sửa trước khi lưu). Hệ thống tự tạo tài khoản Hiệu trưởng đầu tiên.
