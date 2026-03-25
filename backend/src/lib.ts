import dotenv from 'dotenv';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';

dotenv.config();

export const prisma = new PrismaClient();

export const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: () => null,
});

redis.on('error', () => {
  // Redis is optional for MVP; swallow connection errors and keep API alive.
});

export async function connectRedisSafe() {
  try {
    if (redis.status === 'end' || redis.status === 'wait') {
      await redis.connect();
    }
  } catch {
    // allow app to run without redis
  }
}
