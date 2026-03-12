import { NextRequest, NextResponse } from 'next/server';
import { addPrivateMessage, getPrivateMessageById, getPrivateMessages } from '@/lib/in-memory-store';
import { publishEvent } from '@/lib/realtime-bus';

// GET private messages with a user
export async function GET(request: NextRequest) {
  const fromUserId = request.nextUrl.searchParams.get('from_user_id');
  const toUserId = request.nextUrl.searchParams.get('to_user_id');

  if (!fromUserId || !toUserId) {
    return NextResponse.json(
      { error: 'Missing user IDs' },
      { status: 400 }
    );
  }

  try {
    const data = getPrivateMessages(fromUserId, toUserId, 50);
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Private messages fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST send private message
export async function POST(request: NextRequest) {
  const { from_user_id, to_user_id, content } = await request.json();
  const normalizedContent = String(content || '').trim();

  if (!from_user_id || !to_user_id || !normalizedContent) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  try {
    const result = addPrivateMessage(from_user_id, to_user_id, normalizedContent);
    if (!result.ok) {
      if (result.error === 'rate_limited') {
        return NextResponse.json(
          { error: 'Rate limited', retry_after_ms: result.retryAfterMs },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: 'Invalid user' },
        { status: 400 }
      );
    }

    const hydrated =
      getPrivateMessageById(from_user_id, to_user_id, result.message.id) || result.message;

    void publishEvent({
      type: 'private_message_created',
      from_user_id,
      to_user_id,
      message: hydrated,
    });

    return NextResponse.json(hydrated);
  } catch (error) {
    console.error('Private message send error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
