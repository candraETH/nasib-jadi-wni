import { NextRequest, NextResponse } from 'next/server';
import { setUserProfileImage } from '@/lib/in-memory-store';
import { publishEvent } from '@/lib/realtime-bus';
import { redisEnabled, redisSetProfileImage } from '@/lib/redis-store';

export const runtime = 'nodejs';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

function isAllowedDataUrl(value: string) {
  if (!value.startsWith('data:image/')) return false;
  const semi = value.indexOf(';');
  if (semi <= 5) return false;
  const mime = value.slice(5, semi);
  return ALLOWED_MIME.has(mime);
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const profileImageRaw = body?.profile_image;

    let profileImage: string | null = null;
    if (typeof profileImageRaw === 'string' && profileImageRaw.trim()) {
      const trimmed = profileImageRaw.trim();
      if (trimmed.length > 450_000) {
        return NextResponse.json({ error: 'Image too large' }, { status: 413 });
      }
      if (!isAllowedDataUrl(trimmed)) {
        return NextResponse.json({ error: 'Invalid image format' }, { status: 400 });
      }
      profileImage = trimmed;
    }

    const user = redisEnabled()
      ? await redisSetProfileImage(userId, profileImage)
      : setUserProfileImage(userId, profileImage);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    void publishEvent({ type: 'user_profile_image_updated', user_id: userId });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile image update error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile image' },
      { status: 500 }
    );
  }
}
