import { NextRequest, NextResponse } from 'next/server';
import { getRoomMemberCountById, leaveRoom } from '@/lib/in-memory-store';
import { publishEvent } from '@/lib/realtime-bus';

export async function POST(request: NextRequest) {
  const { user_id, room_id } = await request.json();

  if (!user_id) {
    return NextResponse.json(
      { error: 'Missing user_id' },
      { status: 400 }
    );
  }

  try {
    const user = leaveRoom(user_id);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid user' },
        { status: 400 }
      );
    }

    const onlineCount = room_id ? getRoomMemberCountById(room_id) : null;
    if (room_id) {
      void publishEvent({
        type: 'room_leave',
        room_id,
        user_id,
        online_count: onlineCount,
      });
    }

    return NextResponse.json({ success: true, online_count: onlineCount });
  } catch (error) {
    console.error('Room leave error:', error);
    return NextResponse.json(
      { error: 'Failed to leave room' },
      { status: 500 }
    );
  }
}
