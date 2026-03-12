import { randomUUID } from 'crypto';
import { createClient } from 'redis';

type UserStatus = 'online' | 'offline';

export type UserRecord = {
  id: string;
  nickname: string;
  avatar_color: string;
  profile_image?: string | null;
  status: UserStatus;
  last_activity: string;
  created_at: string;
  current_room_id?: string | null;
  last_ip?: string | null;
};

export type UserSnapshot = {
  id: string;
  nickname: string;
  avatar_color: string;
  profile_image: string | null;
};

export type MessageRecord = {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  mentions: string[] | null;
  created_at: string;
  expires_at: string;
  is_deleted?: boolean;
};

const MESSAGE_TTL_MS = 10 * 60 * 1000;
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const MAX_PUBLIC_MESSAGES_PER_ROOM = 300;
const RATE_LIMIT_WINDOW_MS = 15 * 1000;

const COLORS = ['#3B82F6', '#F97316', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6'];

const globalRedis = globalThis as typeof globalThis & {
  __NJW_REDIS__?: ReturnType<typeof createClient>;
  __NJW_REDIS_CONNECTING__?: Promise<void>;
};

function keyNick(normalizedNickname: string) {
  return `njw:nick:${normalizedNickname}`;
}

function keyUser(userId: string) {
  return `njw:user:${userId}`;
}

function keyOnline() {
  return 'njw:online';
}

function keyRoomMessages(roomId: string) {
  return `njw:room:${roomId}:messages`;
}

function keyBlockSet(blockerId: string) {
  return `njw:block:${blockerId}`;
}

function keyRate(userId: string) {
  return `njw:rate:${userId}`;
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeNickname(nickname: string) {
  return nickname.trim().toLowerCase();
}

function pickAvatarColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function toSnapshot(user: UserRecord): UserSnapshot {
  return {
    id: user.id,
    nickname: user.nickname,
    avatar_color: user.avatar_color,
    profile_image: user.profile_image || null,
  };
}

export function redisEnabled() {
  return Boolean(process.env.REDIS_URL);
}

async function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (globalRedis.__NJW_REDIS__) return globalRedis.__NJW_REDIS__;

  const client = createClient({ url: process.env.REDIS_URL });
  client.on('error', (err) => console.error('Redis error:', err));
  globalRedis.__NJW_REDIS__ = client;
  if (!globalRedis.__NJW_REDIS_CONNECTING__) {
    globalRedis.__NJW_REDIS_CONNECTING__ = client.connect().then(() => undefined);
  }
  await globalRedis.__NJW_REDIS_CONNECTING__;
  return client;
}

async function getUserJson(userId: string) {
  const client = await getRedis();
  if (!client) return null;
  const raw = await client.get(keyUser(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserRecord;
  } catch {
    return null;
  }
}

async function setUserJson(user: UserRecord) {
  const client = await getRedis();
  if (!client) return false;
  await client.set(keyUser(user.id), JSON.stringify(user));
  return true;
}

export async function redisGetOrCreateUser(nickname: string, ip?: string | null) {
  const client = await getRedis();
  if (!client) return null;

  const normalized = normalizeNickname(nickname);
  const existingId = await client.get(keyNick(normalized));
  const now = Date.now();

  if (existingId) {
    const existing = await getUserJson(existingId);
    if (existing) {
      existing.status = 'online';
      existing.last_activity = new Date(now).toISOString();
      if (ip) existing.last_ip = ip;
      await setUserJson(existing);
      await client.zAdd(keyOnline(), [{ score: now, value: existing.id }]);
      return existing;
    }
  }

  const user: UserRecord = {
    id: randomUUID(),
    nickname: nickname.trim(),
    avatar_color: pickAvatarColor(),
    profile_image: null,
    status: 'online',
    last_activity: new Date(now).toISOString(),
    created_at: new Date(now).toISOString(),
    current_room_id: null,
    last_ip: ip || null,
  };

  await client.set(keyNick(normalized), user.id);
  await setUserJson(user);
  await client.zAdd(keyOnline(), [{ score: now, value: user.id }]);
  return user;
}

export async function redisGetUserById(userId: string) {
  return await getUserJson(userId);
}

export async function redisTouchUser(userId: string) {
  const client = await getRedis();
  if (!client) return null;
  const user = await getUserJson(userId);
  if (!user) return null;
  const now = Date.now();
  user.last_activity = new Date(now).toISOString();
  await setUserJson(user);
  if (user.status === 'online') {
    await client.zAdd(keyOnline(), [{ score: now, value: user.id }]);
  }
  return user;
}

export async function redisSetUserStatus(userId: string, status: UserStatus) {
  const client = await getRedis();
  if (!client) return null;
  const user = await getUserJson(userId);
  if (!user) return null;
  const now = Date.now();
  user.status = status;
  user.last_activity = new Date(now).toISOString();
  if (status === 'offline') {
    user.current_room_id = null;
    await client.zRem(keyOnline(), user.id);
  } else {
    await client.zAdd(keyOnline(), [{ score: now, value: user.id }]);
  }
  await setUserJson(user);
  return user;
}

export async function redisSetProfileImage(userId: string, profileImage: string | null) {
  const user = await getUserJson(userId);
  if (!user) return null;
  user.profile_image = profileImage;
  user.last_activity = nowIso();
  await setUserJson(user);
  return user;
}

export async function redisListOnlineUsers(limit = 50) {
  const client = await getRedis();
  if (!client) return [];
  const now = Date.now();
  const min = now - ONLINE_WINDOW_MS;
  const ids = (await client.sendCommand([
    'ZREVRANGEBYSCORE',
    keyOnline(),
    String(now),
    String(min),
    'LIMIT',
    '0',
    String(limit),
  ])) as unknown as string[];

  const users: UserSnapshot[] = [];
  for (const id of ids) {
    const user = await getUserJson(id);
    if (user && user.status === 'online') {
      users.push(toSnapshot(user));
    }
  }
  return users;
}

async function redisRateLimit(userId: string): Promise<{ ok: true } | { ok: false; retryAfterMs: number }> {
  const client = await getRedis();
  if (!client) return { ok: true };
  const key = keyRate(userId);
  const set = await client.set(key, String(Date.now()), { PX: RATE_LIMIT_WINDOW_MS, NX: true });
  if (set) return { ok: true };
  const ttl = await client.pTTL(key);
  return { ok: false, retryAfterMs: Math.max(0, ttl) };
}

async function getUserSnapshotById(userId: string): Promise<UserSnapshot> {
  const user = await getUserJson(userId);
  if (!user) {
    return { id: userId, nickname: 'Unknown', avatar_color: '#9CA3AF', profile_image: null };
  }
  return toSnapshot(user);
}

export async function redisIsBlocked(blockerId: string, blockedId: string) {
  const client = await getRedis();
  if (!client) return false;
  return await client.sIsMember(keyBlockSet(blockerId), blockedId);
}

export async function redisAddMessage(roomId: string, userId: string, content: string) {
  const client = await getRedis();
  if (!client) return { ok: false as const, error: 'no_redis' };
  const user = await getUserJson(userId);
  if (!user) return { ok: false as const, error: 'invalid_user' };

  const rate = await redisRateLimit(userId);
  if (!rate.ok) {
    return { ok: false as const, error: 'rate_limited', retryAfterMs: rate.retryAfterMs };
  }

  const mentionRegex = /@(\w+)/g;
  const mentions: string[] = [];
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    mentions.push(match[1]);
  }

  const now = Date.now();
  const message: MessageRecord = {
    id: randomUUID(),
    room_id: roomId,
    user_id: userId,
    content,
    mentions: mentions.length ? mentions : null,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + MESSAGE_TTL_MS).toISOString(),
    is_deleted: false,
  };

  const key = keyRoomMessages(roomId);
  await client.rPush(key, JSON.stringify(message));
  await client.lTrim(key, -MAX_PUBLIC_MESSAGES_PER_ROOM, -1);

  await redisTouchUser(userId);

  const hydrated = {
    ...message,
    users: await getUserSnapshotById(userId),
  };

  return { ok: true as const, message: hydrated };
}

export async function redisGetMessages(roomId: string, limit = 50, currentUserId?: string | null) {
  const client = await getRedis();
  if (!client) return [];
  const raw = (await client.lRange(keyRoomMessages(roomId), -limit, -1)) as string[];
  const now = Date.now();

  const messages: MessageRecord[] = [];
  for (const item of raw) {
    try {
      const parsed = JSON.parse(item) as MessageRecord;
      if (parsed.is_deleted) continue;
      if (new Date(parsed.expires_at).getTime() <= now) continue;
      messages.push(parsed);
    } catch {
      // ignore
    }
  }

  const hydrated = [];
  for (const msg of messages) {
    if (currentUserId) {
      const blocked = await redisIsBlocked(currentUserId, msg.user_id);
      if (blocked) continue;
    }
    hydrated.push({ ...msg, users: await getUserSnapshotById(msg.user_id) });
  }

  return hydrated;
}

