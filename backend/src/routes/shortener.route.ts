import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '../lib.js';
import { shortenRateLimit } from '../middleware/rateLimit.js';
import { createShortLink, isBlockedDomain, registerClick, resolveShortCode, sha256 } from '../services/shortener.service.js';

const router = Router();

const shortenSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string().datetime().optional(),
});

router.post('/api/shorten', shortenRateLimit, async (req, res) => {
  const parsed = shortenSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload', details: parsed.error.issues });

  const target = new URL(parsed.data.url);
  if (!['http:', 'https:'].includes(target.protocol)) {
    return res.status(400).json({ error: 'Only http/https URLs are allowed' });
  }

  if (await isBlockedDomain(target.hostname)) {
    return res.status(400).json({ error: 'Domain is blocked' });
  }

  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
  const created = await createShortLink(parsed.data.url, expiresAt);

  const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return res.json({
    code: created.code,
    shortUrl: `${base}/${created.code}`,
    originalUrl: created.originalUrl,
    expiresAt: created.expiresAt,
    createdAt: created.createdAt,
  });
});

router.get('/api/links', async (req, res) => {
  const limitRaw = Number(req.query.limit ?? 20);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20;

  const links = await prisma.shortLink.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      code: true,
      originalUrl: true,
      createdAt: true,
      expiresAt: true,
      clickCount: true,
    },
  });

  const base = process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`;

  return res.json(
    links.map((link) => ({
      code: link.code,
      shortUrl: `${base}/${link.code}`,
      originalUrl: link.originalUrl,
      createdAt: link.createdAt,
      expiresAt: link.expiresAt,
      clickCount: Number(link.clickCount),
    }))
  );
});

router.get('/api/links/:code/stats', async (req, res) => {
  const { code } = req.params;
  const link = await prisma.shortLink.findUnique({ where: { code } });
  if (!link) return res.status(404).json({ error: 'Not found' });

  const clicksByDay = await prisma.$queryRawUnsafe(
    `SELECT DATE(clickedAt) as day, COUNT(*) as clicks FROM click_events WHERE linkId = ? GROUP BY DATE(clickedAt) ORDER BY day DESC LIMIT 30`,
    Number(link.id)
  );

  const totalEvents = await prisma.clickEvent.count({ where: { linkId: link.id } });
  const uniqueVisitors = await prisma.$queryRawUnsafe(
    `SELECT COUNT(DISTINCT ipHash) as unique_visitors FROM click_events WHERE linkId = ?`,
    Number(link.id)
  ) as Array<{ unique_visitors: bigint | number }>;

  const unique = uniqueVisitors?.[0]?.unique_visitors ?? 0;
  const uniqueVisitorsCount = typeof unique === 'bigint' ? Number(unique) : unique;

  const normalizedClicksByDay = (clicksByDay as Array<{ day: string; clicks: bigint | number }>).map((d) => ({
    day: d.day,
    clicks: typeof d.clicks === 'bigint' ? Number(d.clicks) : d.clicks,
  }));

  return res.json({
    code: link.code,
    originalUrl: link.originalUrl,
    clickCount: Number(link.clickCount),
    totalEvents,
    uniqueVisitors: uniqueVisitorsCount,
    clicksByDay: normalizedClicksByDay,
  });
});

router.get('/:code', async (req, res) => {
  const { code } = req.params;
  const link = await resolveShortCode(code);
  if (!link) return res.status(404).json({ error: 'Link not found' });

  if (!link.isActive) return res.status(410).json({ error: 'Link is inactive' });
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return res.status(410).json({ error: 'Link expired' });

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const ipHash = sha256(ip);

  registerClick(BigInt(link.linkId), ipHash, req.get('user-agent') || undefined, req.get('referer') || undefined)
    .catch(() => undefined);

  return res.redirect(302, link.originalUrl);
});

export default router;
