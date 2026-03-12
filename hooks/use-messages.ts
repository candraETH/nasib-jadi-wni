'use client';

import { useEffect, useState } from 'react';
import {
  addRealtimeListener,
  addRealtimeStatusListener,
  connectRealtime,
  subscribeRoom,
  unsubscribeRoom,
} from '@/lib/realtime-client';

interface User {
  id: string;
  nickname: string;
  avatar_color: string;
}

interface Message {
  id: string;
  content: string;
  user_id: string;
  room_id: string;
  users: User;
  created_at: string;
  mentions?: string[] | null;
  is_deleted?: boolean;
}

export function useMessages(roomId: string, userId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const loadMessages = async () => {
    if (!roomId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/messages?room_id=${roomId}&limit=50`, {
        headers: userId ? { 'x-user-id': userId } : undefined,
      });
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
    if (realtimeConnected) return;
    const interval = setInterval(loadMessages, 8000);
    return () => clearInterval(interval);
  }, [roomId, realtimeConnected, userId]);

  useEffect(() => {
    if (!roomId) return;
    if (userId) {
      connectRealtime(userId);
    }
    subscribeRoom(roomId);

    const unsubscribeStatus = addRealtimeStatusListener((connected) => {
      setRealtimeConnected(connected);
    });

    const unsubscribeEvents = addRealtimeListener((event) => {
      if (event.type === 'message_created' && event.room_id === roomId) {
        if (userId) {
          void loadMessages();
          return;
        }
        if (event.message) {
          setMessages((prev) => {
            if (prev.some((msg) => msg.id === event.message.id)) return prev;
            return [...prev, event.message];
          });
        }
      }

      if (
        event.type === 'message_expired' &&
        event.room_id === roomId &&
        Array.isArray(event.message_ids)
      ) {
        setMessages((prev) => prev.filter((msg) => !event.message_ids.includes(msg.id)));
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeEvents();
      unsubscribeRoom(roomId);
    };
  }, [roomId, userId]);

  const sendMessage = async (
    content: string,
    userId: string
  ): Promise<{ success: boolean; retryAfterMs?: number }> => {
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          user_id: userId,
          content,
        }),
      });

      if (res.ok) {
        if (!realtimeConnected) {
          await loadMessages();
        }
        return { success: true };
      }
      if (res.status === 429) {
        const data = await res.json();
        return { success: false, retryAfterMs: data?.retry_after_ms };
      }
      return { success: false };
    } catch (error) {
      console.error('Failed to send message:', error);
      return { success: false };
    }
  };

  return {
    messages,
    isLoading,
    error,
    sendMessage,
  };
}
