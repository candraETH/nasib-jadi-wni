import { NextRequest, NextResponse } from 'next/server';
import { getRoomMemberCountById, joinRoom } from '@/lib/in-memory-store';
import { publishEvent } from '@/lib/realtime-bus';

export async function POST(request: NextRequest) {
  const { user_id, room_id } = await request.json();

  if (!user_id || !room_id) {
    return NextResponse.json(
      { error: 'Missing user_id or room_id' },
      { status: 400 }
    );
  }

  try {
    const room = joinRoom(user_id, room_id);
    if (!room) {
      return NextResponse.json(
        { error: 'Invalid user or room' },
        { status: 400 }
      );
    }

    const onlineCount = getRoomMemberCountById(room_id);
    void publishEvent({
      type: 'room_join',
      room_id,
      user_id,
      online_count: onlineCount,
    });

    return NextResponse.json({ success: true, room_id, online_count: onlineCount });
  } catch (error) {
    console.error('Room join error:', error);
    return NextResponse.json(
      { error: 'Failed to join room' },
      { status: 500 }
    );
  }
}
