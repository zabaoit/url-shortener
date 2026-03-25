import crypto from 'node:crypto';
import { customAlphabet } from 'nanoid';
import { prisma, redis } from '../lib.js';

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 7);

export function normalizeUrl(url: string): string {
  const u = new URL(url);
  u.hash = '';
  return u.toString();
}

export function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export async function isBlockedDomain(hostname: string): Promise<boolean> {
  const blocked = await prisma.blockedDomain.findUnique({ where: { domain: hostname } });
  return !!blocked;
}

export async function createShortLink(originalUrl: string, expiresAt?: Date | null) {
  const normalized = normalizeUrl(originalUrl);
  const normalizedHash = sha256(normalized);

  let code = nanoid();
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.shortLink.findUnique({ where: { code } });
    if (!exists) break;
    code = nanoid();
  }

  const created = await prisma.shortLink.create({
    data: {
      code,
      originalUrl,
      normalizedUrlHash: normalizedHash,
      expiresAt: expiresAt ?? null,
      isActive: true,
    },
  });

  try {
    await redis.set(`short:${code}`, JSON.stringify({
      originalUrl: created.originalUrl,
      expiresAt: created.expiresAt,
      isActive: created.isActive,
      linkId: created.id.toString(),
    }), 'EX', 3600);
  } catch {}

  return created;
}

export async function resolveShortCode(code: string) {
  try {
    const cached = await redis.get(`short:${code}`);
    if (cached) return JSON.parse(cached) as { originalUrl: string; expiresAt?: string | null; isActive: boolean; linkId: string };
  } catch {}

  const link = await prisma.shortLink.findUnique({ where: { code } });
  if (!link) return null;

  const payload = {
    originalUrl: link.originalUrl,
    expiresAt: link.expiresAt,
    isActive: link.isActive,
    linkId: link.id.toString(),
  };

  try { await redis.set(`short:${code}`, JSON.stringify(payload), 'EX', 3600); } catch {}

  return payload;
}

export async function registerClick(linkId: bigint, ipHash: string, userAgent?: string, referrer?: string) {
  await prisma.$transaction([
    prisma.shortLink.update({ where: { id: linkId }, data: { clickCount: { increment: BigInt(1) } } }),
    prisma.clickEvent.create({
      data: { linkId, ipHash, userAgent: userAgent ?? null, referrer: referrer ?? null },
    }),
  ]);
}
