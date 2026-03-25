# URL Shortener (Bitly Clone) - Fullstack

## Structure
- `backend`: Express + TypeScript + Prisma + MySQL + Redis
- `frontend`: React + TypeScript + Tailwind (Vite)

## Business flow covered
1. `POST /api/shorten`: validate URL, check blocked domains, generate unique code, store mapping.
2. `GET /:code`: resolve via Redis/DB, check active + expiry, async click logging, redirect.
3. `GET /api/links/:code/stats`: click counters + click by day.

## Quick start
### 1) Infra
```bash
docker compose up -d
```

### 2) Backend
```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:push
npm run dev
```

### 3) Frontend
```bash
cd frontend
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8080

## Notes
- Redis cache key: `short:{code}` (TTL 1 hour)
- Rate limit on shorten endpoint
- `blocked_domains` table for abuse prevention
