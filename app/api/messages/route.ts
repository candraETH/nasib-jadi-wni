import { NextRequest, NextResponse } from 'next/server';
import { addMessage, getMessageById, getMessages, isBlocked } from '@/lib/in-memory-store';
import { publishEvent } from '@/lib/realtime-bus';
import { redisAddMessage, redisEnabled, redisGetMessages } from '@/lib/redis-store';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const roomId = request.nextUrl.searchParams.get('room_id');
  const limitParam = parseInt(request.nextUrl.searchParams.get('limit') || '50');
  const limit = Number.isFinite(limitParam) ? limitParam : 50;
  const currentUserId = request.headers.get('x-user-id');

  if (!roomId) {
    return NextResponse.json({ error: 'Missing room_id' }, { status: 400 });
  }

  try {
    let data = redisEnabled()
      ? await redisGetMessages(roomId, limit, currentUserId)
      : getMessages(roomId, limit);
    if (!redisEnabled() && currentUserId) {
      data = data.filter((message) => !isBlocked(currentUserId, message.user_id));
    }
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Messages fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { room_id, user_id, content } = await request.json();
  const normalizedContent = String(content || '').trim();

  if (!user_id || !room_id || !normalizedContent) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  try {
    const result = redisEnabled()
      ? await redisAddMessage(room_id, user_id, normalizedContent)
      : addMessage(room_id, user_id, normalizedContent);
    if (!result.ok) {
      if (result.error === 'rate_limited') {
        return NextResponse.json(
          { error: 'Rate limited', retry_after_ms: result.retryAfterMs },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: 'Invalid user or room' },
        { status: 400 }
      );
    }

    const hydrated = redisEnabled()
      ? result.message
      : getMessageById(room_id, result.message.id) || result.message;
    void publishEvent({
      type: 'message_created',
      room_id,
      message: hydrated,
    });

    return NextResponse.json(hydrated);
  } catch (error) {
    console.error('Message send error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
