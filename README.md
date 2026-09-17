# Hệ thống Quản lý Trường Mầm non (đa đơn vị)

SaaS đa-tenant cho trường mầm non: nhiều trường dùng chung hệ thống, truy cập độc lập qua slug riêng (`/mamnon_<ten-truong>`).

- Tài liệu yêu cầu: [`docs/SRS.md`](docs/SRS.md)
- Kiến trúc kỹ thuật / API contract: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Backend: Go (Gin) — [`backend/`](backend/)
- Frontend: Next.js (App Router, TypeScript, Tailwind) — [`frontend/`](frontend/)
- CSDL: PostgreSQL, shared schema + `tenant_id`

## Chạy local

```bash
# 1. Backend
cd backend
cp .env.example .env   # điền DATABASE_URL, JWT_SECRET thật
go run ./cmd/api

# 2. Frontend
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## Triển khai production

Xem [`deploy/README.md`](deploy/README.md) — chạy trực tiếp bằng `launchd` (macOS), Nginx làm reverse proxy nội bộ, Cloudflare Tunnel đưa ra domain `mamnon.vietsoftware.vn`.
