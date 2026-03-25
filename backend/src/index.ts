import express from 'express';
import cors from 'cors';
import shortenerRouter from './routes/shortener.route.js';
import { connectRedisSafe, prisma, redis } from './lib.js';

const app = express();
const PORT = Number(process.env.PORT || 8080);

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || '*' }));
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
