import { NextResponse } from 'next/server';
import { createClient } from 'redis';

const REDIS_TIMEOUT_MS = 1000;

export async function GET() {
  const timestamp = new Date().toISOString();
  const redisUrl = process.env.REDIS_URL || '';

  if (!redisUrl) {
    return NextResponse.json({
      status: 'ok',
      timestamp,
      ws: { status: 'ok', path: '/ws' },
      redis: { status: 'disabled' },
    });
  }

  let client: ReturnType<typeof createClient> | null = null;
  try {
    client = createClient({ url: redisUrl });
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Redis ping timeout')), REDIS_TIMEOUT_MS)
    );
    await client.connect();
    await Promise.race([client.ping(), timeout]);
    return NextResponse.json({
      status: 'ok',
      timestamp,
      ws: { status: 'ok', path: '/ws' },
      redis: { status: 'ok' },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'degraded',
        timestamp,
        ws: { status: 'ok', path: '/ws' },
        redis: { status: 'error', message: error instanceof Error ? error.message : 'Unknown error' },
      },
      { status: 503 }
    );
  } finally {
    if (client) {
      try {
        await client.quit();
      } catch {
        // ignore cleanup errors
      }
    }
  }
}
