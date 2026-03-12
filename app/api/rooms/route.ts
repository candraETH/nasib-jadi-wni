import { NextResponse } from 'next/server';
import { createRoom, listRooms } from '@/lib/in-memory-store';
import { publishEvent } from '@/lib/realtime-bus';

export async function GET() {
  try {
    const rooms = listRooms()
      .filter((room) => room.is_public)
      .sort((a, b) => (b.online_count || 0) - (a.online_count || 0));
    return NextResponse.json(rooms);
  } catch (error) {
    console.error('Rooms fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch rooms' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const { name, description, category, created_by } = await request.json();

  try {
    if (!name) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    const room = createRoom({ name, description, category, created_by, icon: '' });
    if (!room) {
      return NextResponse.json(
        { error: 'Room already exists' },
        { status: 409 }
      );
    }

    void publishEvent({
      type: 'room_created',
      room,
    });
    return NextResponse.json(room);
  } catch (error) {
    console.error('Room creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create room' },
      { status: 500 }
    );
  }
}
