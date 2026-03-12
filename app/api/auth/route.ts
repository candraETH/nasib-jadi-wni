import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOrCreateUser, getUserById, setUserStatus } from '@/lib/in-memory-store';
import { publishEvent } from '@/lib/realtime-bus';
import {
  redisEnabled,
  redisGetOrCreateUser,
  redisGetUserById,
  redisSetUserStatus,
} from '@/lib/redis-store';

export const runtime = 'nodejs';

// GET user info
export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'No user ID' }, { status: 401 });
    }

    const user = redisEnabled() ? await redisGetUserById(userId) : getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 });
  }
}

// POST login or update status
export async function POST(request: NextRequest) {
  const { nickname } = await request.json();
  const normalizedNickname = String(nickname || '').trim();

  try {
    if (normalizedNickname) {
      const user = redisEnabled()
        ? await redisGetOrCreateUser(normalizedNickname, request.ip || null)
        : getOrCreateUser(normalizedNickname, request.ip || null);

      if (!user) {
        return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
      }

      // Set session cookie
      const cookieStore = await cookies();
      cookieStore.set('user_id', user.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      });

      return NextResponse.json(user);
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Auth error:', JSON.stringify(error, null, 2));
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

// PATCH update status
export async function PATCH(request: NextRequest) {
  const { userId, status } = await request.json();

  try {
    if (!userId || !status) {
      return NextResponse.json(
        { error: 'Missing userId or status' },
        { status: 400 }
      );
    }

    const user = redisEnabled()
      ? await redisSetUserStatus(userId, status)
      : setUserStatus(userId, status);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    void publishEvent({
      type: 'user_status',
      user_id: userId,
      status,
    });
    return NextResponse.json(user);
  } catch (error) {
    console.error('Status update error:', error);
    return NextResponse.json({ error: 'Failed to update status' }, { status: 500 });
  }
}
