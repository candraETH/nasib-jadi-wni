'use client';

type RealtimeEvent = {
  type: string;
  room_id?: string;
  user_id?: string;
  from_user_id?: string;
  to_user_id?: string;
  message?: any;
  message_ids?: string[];
  [key: string]: any;
};

type StatusListener = (connected: boolean) => void;
type EventListener = (event: RealtimeEvent) => void;

const listeners = new Set<EventListener>();
const statusListeners = new Set<StatusListener>();
const subscribedRooms = new Set<string>();
let socket: WebSocket | null = null;
let connected = false;
let currentUserId: string | null = null;
let reconnectTimer: number | null = null;
const pendingQueue: string[] = [];

function getWsUrl() {
  if (typeof window === 'undefined') return '';
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws`;
}

function notifyStatus(nextStatus: boolean) {
  connected = nextStatus;
  for (const listener of statusListeners) {
    listener(nextStatus);
  }
}

function flushQueue() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  while (pendingQueue.length > 0) {
    const payload = pendingQueue.shift();
    if (payload) socket.send(payload);
  }
}

function send(payload: Record<string, unknown>) {
  const message = JSON.stringify(payload);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(message);
  } else {
    pendingQueue.push(message);
  }
}

function scheduleReconnect() {
  if (reconnectTimer || typeof window === 'undefined') return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    if (currentUserId) connectRealtime(currentUserId);
  }, 2000);
}

export function connectRealtime(userId: string) {
  if (!userId || typeof window === 'undefined') return;
  currentUserId = userId;

  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    send({ type: 'identify', user_id: currentUserId });
    return;
  }

  const url = getWsUrl();
  if (!url) return;
  socket = new WebSocket(url);

  socket.onopen = () => {
    notifyStatus(true);
    send({ type: 'identify', user_id: currentUserId });
    for (const roomId of subscribedRooms) {
      send({ type: 'subscribe_room', room_id: roomId, user_id: currentUserId });
    }
    flushQueue();
  };

  socket.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      for (const listener of listeners) {
        listener(payload);
      }
    } catch (error) {
      console.error('Realtime parse error:', error);
    }
  };

  socket.onclose = () => {
    notifyStatus(false);
    scheduleReconnect();
  };

  socket.onerror = () => {
    notifyStatus(false);
  };
}

export function addRealtimeListener(listener: EventListener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addRealtimeStatusListener(listener: StatusListener) {
  statusListeners.add(listener);
  listener(connected);
  return () => statusListeners.delete(listener);
}

export function subscribeRoom(roomId: string) {
  if (!roomId) return;
  subscribedRooms.add(roomId);
  if (currentUserId) {
    send({ type: 'subscribe_room', room_id: roomId, user_id: currentUserId });
  }
}

export function unsubscribeRoom(roomId: string) {
  if (!roomId) return;
  subscribedRooms.delete(roomId);
  send({ type: 'unsubscribe_room', room_id: roomId });
}
