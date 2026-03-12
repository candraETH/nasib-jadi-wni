import { NextRequest, NextResponse } from 'next/server';
import { listOnlineUsers, touchUser } from '@/lib/in-memory-store';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (userId) {
      touchUser(userId);
    }

    const users = listOnlineUsers(50);

    return NextResponse.json({
      success: true,
      users: users || [],
      count: users?.length || 0,
    });
  } catch (error) {
    console.error('Online users fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch online users', success: false },
      { status: 500 }
    );
  }
}
