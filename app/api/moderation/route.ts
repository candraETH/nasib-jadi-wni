import { NextRequest, NextResponse } from 'next/server';
import { blockUser, isBlocked, logModerationReport, unblockUser } from '@/lib/in-memory-store';

// POST report message or user
export async function POST(request: NextRequest) {
  const { action, messageId, targetUserId, moderatorId, roomId, reason } =
    await request.json();

  if (!action || !moderatorId) {
    return NextResponse.json(
      { error: 'Missing required fields' },
      { status: 400 }
    );
  }

  try {
    if (action === 'report') {
      const data = logModerationReport({
        messageId,
        targetUserId,
        moderatorId,
        roomId,
        reason,
      });
      return NextResponse.json(data);
    }

    if (action === 'block') {
      if (!targetUserId) {
        return NextResponse.json(
          { error: 'Missing target user' },
          { status: 400 }
        );
      }
      const data = blockUser(moderatorId, targetUserId);
      return NextResponse.json(data);
    }

    if (action === 'unblock') {
      if (!targetUserId) {
        return NextResponse.json(
          { error: 'Missing target user' },
          { status: 400 }
        );
      }
      const data = unblockUser(moderatorId, targetUserId);
      return NextResponse.json(data);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Moderation error:', error);
    return NextResponse.json(
      { error: 'Moderation action failed' },
      { status: 500 }
    );
  }
}

// GET check if user is blocked
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('user_id');
  const blockerId = request.nextUrl.searchParams.get('blocker_id');

  if (!userId || !blockerId) {
    return NextResponse.json(
      { error: 'Missing user IDs' },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({ isBlocked: isBlocked(blockerId, userId) });
  } catch (error) {
    console.error('Block check error:', error);
    return NextResponse.json(
      { error: 'Failed to check block status' },
      { status: 500 }
    );
  }
}
