import express from 'express';
import cors from 'cors';
import shortenerRouter from './routes/shortener.route.js';
import { connectRedisSafe, prisma, redis } from './lib.js';

const app = express();
const PORT = Number(process.env.PORT || 8080);

const defaultOrigins = ['http://localhost:5173', 'https://zabaoit.github.io'];
const envOrigins = (process.env.FRONTEND_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowedOrigins = Array.from(new Set([...defaultOrigins, ...envOrigins]));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
  })
);
app.use(express.json());

app.get('/health', async (_req, res) => {
  let redisOk = false;
  try {
    redisOk = redis.status === 'ready';
  } catch {}
  res.json({ ok: true, redis: redisOk });
});

app.use(shortenerRouter);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

(async () => {
  await connectRedisSafe();
  await prisma.$connect();

  app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
  });
})();
