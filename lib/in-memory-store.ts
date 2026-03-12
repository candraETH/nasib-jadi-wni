import { randomUUID } from 'crypto';
import { publishEvent } from '@/lib/realtime-bus';

type UserStatus = 'online' | 'offline';

export interface User {
  id: string;
  nickname: string;
  avatar_color: string;
  profile_image?: string | null;
  status: UserStatus;
  last_activity: string;
  created_at: string;
  current_room_id?: string | null;
  last_ip?: string | null;
}

export interface Room {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  is_public: boolean;
  created_by?: string | null;
  created_at: string;
  slow_mode_seconds?: number;
}

export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  mentions: string[] | null;
  created_at: string;
  expires_at: string;
  is_deleted?: boolean;
}

export interface PrivateMessage {
  id: string;
  from_user_id: string;
  to_user_id: string;
  content: string;
  created_at: string;
  expires_at: string;
  is_deleted?: boolean;
}

interface ModerationLog {
  id: string;
  message_id?: string | null;
  target_user_id?: string | null;
  moderator_id: string;
  room_id?: string | null;
  action: 'report' | 'block' | 'unblock';
  reason?: string | null;
  created_at: string;
}

interface Store {
  users: Map<string, User>;
  usersByNickname: Map<string, string>;
  rooms: Map<string, Room>;
  roomMembers: Map<string, Set<string>>;
  messagesByRoom: Map<string, Message[]>;
  privateMessagesByPair: Map<string, PrivateMessage[]>;
  moderationLogs: ModerationLog[];
  blockedUsers: Set<string>;
  userRateLimits: Map<string, number[]>;
}

const MESSAGE_TTL_MS = 10 * 60 * 1000;
const ONLINE_WINDOW_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 60 * 1000;
const MAX_PUBLIC_MESSAGES_PER_ROOM = 300;
const MAX_PRIVATE_MESSAGES_PER_PAIR = 200;
const RATE_LIMIT_WINDOW_MS = 15 * 1000;
const RATE_LIMIT_MAX_MESSAGES = 1;

const DEFAULT_ROOMS: Array<Pick<Room, 'id' | 'name' | 'description' | 'category' | 'icon'>> = [
  { id: 'curhat', name: 'Curhat WNI', description: 'Ruang curhat santai', category: 'general', icon: '' },
  { id: 'ngoding', name: 'Ngoding', description: 'Ngoding bareng', category: 'tech', icon: '' },
  { id: 'olahraga', name: 'Olahraga', description: 'Ngobrol olahraga', category: 'sports', icon: '' },
  { id: 'gaming', name: 'Gaming', description: 'Main dan diskusi game', category: 'gaming', icon: '' },
  { id: 'relationship', name: 'Relationship', description: 'Obrolan hubungan', category: 'general', icon: '' },
  { id: 'random', name: 'Random Room', description: 'Topik bebas', category: 'general', icon: '' },
];

const globalStore = globalThis as typeof globalThis & {
  __NJW_STORE__?: Store;
  __NJW_CLEANUP__?: NodeJS.Timeout;
};

function getStore(): Store {
  if (!globalStore.__NJW_STORE__) {
    const rooms = new Map<string, Room>();
    const now = new Date().toISOString();
    for (const room of DEFAULT_ROOMS) {
      rooms.set(room.id, {
        ...room,
        is_public: true,
        created_at: now,
        slow_mode_seconds: 15,
      });
    }

    globalStore.__NJW_STORE__ = {
      users: new Map(),
      usersByNickname: new Map(),
      rooms,
      roomMembers: new Map(),
      messagesByRoom: new Map(),
      privateMessagesByPair: new Map(),
      moderationLogs: [],
      blockedUsers: new Set(),
      userRateLimits: new Map(),
    };

    ensureCleanupTimer(globalStore.__NJW_STORE__);
  }
  return globalStore.__NJW_STORE__!;
}

function ensureCleanupTimer(store: Store) {
  if (globalStore.__NJW_CLEANUP__) return;
  globalStore.__NJW_CLEANUP__ = setInterval(() => {
    cleanupExpiredMessages(store);
  }, CLEANUP_INTERVAL_MS);
  if (globalStore.__NJW_CLEANUP__?.unref) {
    globalStore.__NJW_CLEANUP__.unref();
  }
}

function cleanupExpiredMessages(store: Store) {
  const now = Date.now();

  for (const [roomId, messages] of store.messagesByRoom.entries()) {
    const expiredIds = messages
      .filter((message) => isExpired(message.expires_at, now))
      .map((message) => message.id);
    const filtered = messages.filter((message) => !isExpired(message.expires_at, now));
    if (filtered.length === 0) {
      store.messagesByRoom.delete(roomId);
    } else {
      store.messagesByRoom.set(roomId, filtered);
    }
    if (expiredIds.length > 0) {
      publishSafe({
        type: 'message_expired',
        room_id: roomId,
        message_ids: expiredIds,
      });
    }
  }

  for (const [pairKey, messages] of store.privateMessagesByPair.entries()) {
    const expiredIds = messages
      .filter((message) => isExpired(message.expires_at, now))
      .map((message) => message.id);
    const filtered = messages.filter((message) => !isExpired(message.expires_at, now));
    if (filtered.length === 0) {
      store.privateMessagesByPair.delete(pairKey);
    } else {
      store.privateMessagesByPair.set(pairKey, filtered);
    }
    if (expiredIds.length > 0) {
      const [fromUserId, toUserId] = pairKey.split(':');
      publishSafe({
        type: 'private_message_expired',
        user_ids: [fromUserId, toUserId],
        message_ids: expiredIds,
      });
    }
  }
}

function isExpired(expiresAt: string, nowMs = Date.now()): boolean {
  return new Date(expiresAt).getTime() <= nowMs;
}

function nowIso() {
  return new Date().toISOString();
}

function buildUserSnapshot(user: User) {
  return {
    id: user.id,
    nickname: user.nickname,
    avatar_color: user.avatar_color,
    profile_image: user.profile_image || null,
  };
}

function getUserSnapshotById(store: Store, userId: string) {
  const user = store.users.get(userId);
  if (user) return buildUserSnapshot(user);
  return {
    id: userId,
    nickname: 'Unknown',
    avatar_color: '#9CA3AF',
    profile_image: null,
  };
}

function normalizeNickname(nickname: string) {
  return nickname.trim().toLowerCase();
}

function getRateLimitKey(userId: string) {
  return `user:${userId}`;
}

function checkRateLimit(store: Store, userId: string): { ok: true } | { ok: false; retryAfterMs: number } {
  const key = getRateLimitKey(userId);
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = (store.userRateLimits.get(key) || []).filter((ts) => ts > windowStart);
  if (timestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
    const retryAfterMs = Math.max(0, RATE_LIMIT_WINDOW_MS - (now - timestamps[0]));
    store.userRateLimits.set(key, timestamps);
    return { ok: false, retryAfterMs };
  }
  timestamps.push(now);
  store.userRateLimits.set(key, timestamps);
  return { ok: true };
}

export function getOrCreateUser(nickname: string, ip?: string | null) {
  const store = getStore();
  const normalized = normalizeNickname(nickname);
  const existingId = store.usersByNickname.get(normalized);
  if (existingId) {
    const existingUser = store.users.get(existingId);
    if (existingUser) {
      existingUser.status = 'online';
      existingUser.last_activity = nowIso();
      if (ip) existingUser.last_ip = ip;
      store.users.set(existingId, existingUser);
      return existingUser;
    }
  }

  const id = randomUUID();
  const user: User = {
    id,
    nickname: nickname.trim(),
    avatar_color: generateAvatarColor(),
    status: 'online',
    last_activity: nowIso(),
    created_at: nowIso(),
    current_room_id: null,
    last_ip: ip || null,
  };

  store.users.set(id, user);
  store.usersByNickname.set(normalized, id);
  return user;
}

export function getUserById(userId: string) {
  const store = getStore();
  return store.users.get(userId) || null;
}

export function touchUser(userId: string) {
  const store = getStore();
  const user = store.users.get(userId);
  if (!user) return null;
  user.last_activity = nowIso();
  store.users.set(userId, user);
  return user;
}

export function setUserProfileImage(userId: string, profileImage: string | null) {
  const store = getStore();
  const user = store.users.get(userId);
  if (!user) return null;
  user.profile_image = profileImage;
  user.last_activity = nowIso();
  store.users.set(userId, user);
  return user;
}

export function setUserStatus(userId: string, status: UserStatus) {
  const store = getStore();
  const user = store.users.get(userId);
  if (!user) return null;
  user.status = status;
  user.last_activity = nowIso();
  if (status === 'offline') {
    removeUserFromRoom(store, userId);
    user.current_room_id = null;
  }
  store.users.set(userId, user);
  return user;
}

export function listOnlineUsers(limit = 50) {
  const store = getStore();
  const now = Date.now();
  const users = Array.from(store.users.values()).filter((user) => {
    if (user.status !== 'online') return false;
    const last = new Date(user.last_activity).getTime();
    return now - last <= ONLINE_WINDOW_MS;
  });
  return users.slice(0, limit).map(buildUserSnapshot);
}

export function listRooms() {
  const store = getStore();
  return Array.from(store.rooms.values()).map((room) => ({
    ...room,
    online_count: getRoomMemberCount(store, room.id),
    member_count: getRoomMemberCount(store, room.id),
  }));
}

export function createRoom(input: {
  name: string;
  description?: string;
  category?: string;
  created_by?: string | null;
  icon?: string;
}) {
  const store = getStore();
  const id = input.name.trim().toLowerCase().replace(/\s+/g, '-');
  if (store.rooms.has(id)) {
    return null;
  }
  const room: Room = {
    id,
    name: input.name.trim(),
    description: input.description?.trim() || '',
    category: input.category?.trim() || 'general',
    icon: input.icon?.trim() || '',
    is_public: true,
    created_by: input.created_by || null,
    created_at: nowIso(),
    slow_mode_seconds: 15,
  };
  store.rooms.set(id, room);
  return room;
}

export function joinRoom(userId: string, roomId: string) {
  const store = getStore();
  const user = store.users.get(userId);
  const room = store.rooms.get(roomId);
  if (!user || !room) return null;

  if (user.current_room_id && user.current_room_id !== roomId) {
    removeUserFromRoom(store, userId);
  }

  const members = store.roomMembers.get(roomId) || new Set<string>();
  members.add(userId);
  store.roomMembers.set(roomId, members);
  user.current_room_id = roomId;
  user.last_activity = nowIso();
  store.users.set(userId, user);
  return room;
}

export function leaveRoom(userId: string) {
  const store = getStore();
  const user = store.users.get(userId);
  if (!user) return null;
  removeUserFromRoom(store, userId);
  user.current_room_id = null;
  user.last_activity = nowIso();
  store.users.set(userId, user);
  return user;
}

function removeUserFromRoom(store: Store, userId: string) {
  for (const [roomId, members] of store.roomMembers.entries()) {
    if (members.has(userId)) {
      members.delete(userId);
      if (members.size === 0) {
        store.roomMembers.delete(roomId);
      } else {
        store.roomMembers.set(roomId, members);
      }
    }
  }
}

export function addMessage(roomId: string, userId: string, content: string) {
  const store = getStore();
  const user = store.users.get(userId);
  const room = store.rooms.get(roomId);
  if (!user || !room) {
    return { ok: false as const, error: 'invalid_user_or_room' };
  }

  const rate = checkRateLimit(store, userId);
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
  const message: Message = {
    id: randomUUID(),
    room_id: roomId,
    user_id: userId,
    content,
    mentions: mentions.length ? mentions : null,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + MESSAGE_TTL_MS).toISOString(),
    is_deleted: false,
  };

  const messages = store.messagesByRoom.get(roomId) || [];
  messages.push(message);
  if (messages.length > MAX_PUBLIC_MESSAGES_PER_ROOM) {
    messages.splice(0, messages.length - MAX_PUBLIC_MESSAGES_PER_ROOM);
  }
  store.messagesByRoom.set(roomId, messages);

  joinRoom(userId, roomId);
  return { ok: true as const, message };
}

export function getMessages(roomId: string, limit = 50) {
  const store = getStore();
  cleanupExpiredMessages(store);
  const messages = store.messagesByRoom.get(roomId) || [];
  const visible = messages.filter((message) => !message.is_deleted);
  return visible.slice(-limit).map((message) => ({
    ...message,
    users: getUserSnapshotById(store, message.user_id),
  }));
}

export function getMessageById(roomId: string, messageId: string) {
  const store = getStore();
  const messages = store.messagesByRoom.get(roomId) || [];
  const message = messages.find((item) => item.id === messageId);
  if (!message) return null;
  return {
    ...message,
    users: getUserSnapshotById(store, message.user_id),
  };
}

export function addPrivateMessage(fromUserId: string, toUserId: string, content: string) {
  const store = getStore();
  const fromUser = store.users.get(fromUserId);
  const toUser = store.users.get(toUserId);
  if (!fromUser || !toUser) {
    return { ok: false as const, error: 'invalid_user' };
  }

  const rate = checkRateLimit(store, fromUserId);
  if (!rate.ok) {
    return { ok: false as const, error: 'rate_limited', retryAfterMs: rate.retryAfterMs };
  }

  const now = Date.now();
  const message: PrivateMessage = {
    id: randomUUID(),
    from_user_id: fromUserId,
    to_user_id: toUserId,
    content,
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + MESSAGE_TTL_MS).toISOString(),
    is_deleted: false,
  };

  const pairKey = getPairKey(fromUserId, toUserId);
  const messages = store.privateMessagesByPair.get(pairKey) || [];
  messages.push(message);
  if (messages.length > MAX_PRIVATE_MESSAGES_PER_PAIR) {
    messages.splice(0, messages.length - MAX_PRIVATE_MESSAGES_PER_PAIR);
  }
  store.privateMessagesByPair.set(pairKey, messages);

  touchUser(fromUserId);
  touchUser(toUserId);

  return { ok: true as const, message };
}

export function getPrivateMessages(fromUserId: string, toUserId: string, limit = 50) {
  const store = getStore();
  cleanupExpiredMessages(store);
  const pairKey = getPairKey(fromUserId, toUserId);
  const messages = store.privateMessagesByPair.get(pairKey) || [];
  const visible = messages.filter((message) => !message.is_deleted);
  return visible.slice(-limit).map((message) => ({
    ...message,
    from_user: getUserSnapshotById(store, message.from_user_id),
    to_user: getUserSnapshotById(store, message.to_user_id),
  }));
}

export function getPrivateMessageById(fromUserId: string, toUserId: string, messageId: string) {
  const store = getStore();
  const pairKey = getPairKey(fromUserId, toUserId);
  const messages = store.privateMessagesByPair.get(pairKey) || [];
  const message = messages.find((item) => item.id === messageId);
  if (!message) return null;
  return {
    ...message,
    from_user: getUserSnapshotById(store, message.from_user_id),
    to_user: getUserSnapshotById(store, message.to_user_id),
  };
}

export function logModerationReport(input: {
  messageId?: string | null;
  targetUserId?: string | null;
  moderatorId: string;
  roomId?: string | null;
  reason?: string | null;
}) {
  const store = getStore();
  const log: ModerationLog = {
    id: randomUUID(),
    message_id: input.messageId || null,
    target_user_id: input.targetUserId || null,
    moderator_id: input.moderatorId,
    room_id: input.roomId || null,
    action: 'report',
    reason: input.reason || null,
    created_at: nowIso(),
  };
  store.moderationLogs.push(log);
  return log;
}

export function blockUser(blockerId: string, blockedId: string) {
  const store = getStore();
  const key = `${blockerId}:${blockedId}`;
  store.blockedUsers.add(key);
  const log: ModerationLog = {
    id: randomUUID(),
    target_user_id: blockedId,
    moderator_id: blockerId,
    action: 'block',
    created_at: nowIso(),
  };
  store.moderationLogs.push(log);
  return { success: true };
}

export function unblockUser(blockerId: string, blockedId: string) {
  const store = getStore();
  const key = `${blockerId}:${blockedId}`;
  store.blockedUsers.delete(key);
  const log: ModerationLog = {
    id: randomUUID(),
    target_user_id: blockedId,
    moderator_id: blockerId,
    action: 'unblock',
    created_at: nowIso(),
  };
  store.moderationLogs.push(log);
  return { success: true };
}

export function isBlocked(blockerId: string, blockedId: string) {
  const store = getStore();
  const key = `${blockerId}:${blockedId}`;
  return store.blockedUsers.has(key);
}

export function getRoomMemberCount(store: Store, roomId: string) {
  const members = store.roomMembers.get(roomId);
  return members ? members.size : 0;
}

export function getRoomMemberCountById(roomId: string) {
  const store = getStore();
  return getRoomMemberCount(store, roomId);
}

function generateAvatarColor(): string {
  const colors = ['#3B82F6', '#F97316', '#10B981', '#8B5CF6', '#EC4899', '#14B8A6'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function getPairKey(a: string, b: string) {
  return [a, b].sort().join(':');
}

function publishSafe(event: Record<string, unknown>) {
  try {
    const publish = publishEvent as unknown as (payload: Record<string, unknown>) => Promise<void>;
    if (typeof publish === 'function') {
      void publish(event);
    }
  } catch (error) {
    console.error('Realtime publish error:', error);
  }
}
