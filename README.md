# URL Shortener (Bitly Clone) - Fullstack

Dự án rút gọn link kiểu Bitly, gồm backend API + frontend UI + thống kê click.

## 1) Công nghệ

- **Backend:** Node.js, Express, TypeScript, Prisma, MySQL, Redis
- **Frontend:** React, TypeScript, TailwindCSS, Vite
- **Infra local:** Docker Compose (MySQL + Redis)
- **Public domain (tuỳ chọn):** Cloudflare Tunnel

## 2) Cấu trúc thư mục

- `backend/` — API, Prisma schema, business logic
- `frontend/` — UI tạo link, lịch sử link, stats
- `docker-compose.yml` — MySQL + Redis

## 3) API hiện có

### `POST /api/shorten`
Tạo short link.

Body:
```json
{
  "url": "https://example.com",
  "expiresAt": "2026-12-31T10:00:00.000Z"
}
```
`expiresAt` là optional.

---

### `GET /:code`
Redirect 302 sang link gốc nếu hợp lệ.

---

### `GET /api/links/:code/stats`
Lấy thống kê cho 1 mã:
- clickCount
- totalEvents
- uniqueVisitors
- clicksByDay

---

### `GET /api/links?limit=30`
Lấy danh sách short link mới nhất để hiển thị lịch sử ở UI.

## 4) Chạy local

### Bước 1: chạy DB + Redis
```bash
docker compose up -d mysql redis
```

### Bước 2: backend
```bash
cd backend
npm install
cp .env.example .env
```

Sửa `.env`:
```env
PORT=8080
APP_BASE_URL=http://localhost:8080
FRONTEND_ORIGIN=http://localhost:5173
DATABASE_URL="mysql://root:password@localhost:3306/url_shortener"
REDIS_URL=redis://127.0.0.1:6379
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=20
```

Chạy:
```bash
npm run prisma:push
npm run dev
```

### Bước 3: frontend
```bash
cd frontend
npm install
npm run dev
```

## 5) URLs local

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`

## 6) Dùng domain thật với Cloudflare Tunnel (không cần VPS)

> Yêu cầu: domain đã quản lý DNS bởi Cloudflare.

### 6.1 Cài và login cloudflared
```bash
cloudflared tunnel login
```

### 6.2 Tạo tunnel và map DNS
```bash
cloudflared tunnel create lynkio-short
cloudflared tunnel route dns lynkio-short go.lynkio.space
```

### 6.3 Tạo file `C:\Users\<USER>\.cloudflared\config.yml`
```yaml
tunnel: <TUNNEL_ID>
credentials-file: C:\Users\<USER>\.cloudflared\<TUNNEL_ID>.json

ingress:
  - hostname: go.lynkio.space
    service: http://localhost:8080
  - service: http_status:404
```

> Lưu ý: key phải là `ingress` (không phải `inress`).

### 6.4 Chạy tunnel
```bash
cloudflared tunnel --config "C:\Users\<USER>\.cloudflared\config.yml" run lynkio-short
```

### 6.5 Đổi base URL backend
Trong `backend/.env`:
```env
APP_BASE_URL=https://go.lynkio.space
```
restart backend.

## 7) Troubleshooting nhanh

### Lỗi `EADDRINUSE: 8080`
Port 8080 đang bị process khác chiếm.
```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen |
  Select-Object -ExpandProperty OwningProcess |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

### Lỗi `P1000 Authentication failed`
Sai user/password MySQL trong `DATABASE_URL`.
- Nếu password có ký tự đặc biệt (`@`, `#`, ...) phải URL-encode.

### Lỗi `P1001 Can't reach database server`
MySQL chưa chạy.
```bash
docker compose up -d mysql
```

### `go.<domain>` trả `503`
Tunnel chạy nhưng chưa có `config.yml` đúng hoặc thiếu `ingress`.

### `cloudflared` không nhận lệnh
Mở terminal mới sau khi cài, hoặc chạy exe trực tiếp trong `C:\Program Files\cloudflared`.

## 8) Bảo mật / Git

- Không commit file `.env`.
- Dùng `backend/.env.example` để mô tả biến môi trường (không chứa secret).
- Repo đã có `.gitignore` chặn các file runtime/build phù hợp.
