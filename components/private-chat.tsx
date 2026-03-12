'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, X, MessageCircle } from 'lucide-react';
import { formatTimeAgo } from '@/lib/utils';
import {
  addRealtimeListener,
  addRealtimeStatusListener,
  connectRealtime,
} from '@/lib/realtime-client';

interface User {
  id: string;
  nickname: string;
  avatar_color: string;
  profile_image?: string | null;
}

interface PrivateMessage {
  id: string;
  content: string;
  from_user_id: string;
  to_user_id: string;
  from_user: User;
  to_user: User;
  created_at: string;
  is_deleted?: boolean;
}

interface PrivateChatProps {
  currentUserId: string;
  otherUser: User;
  onClose: () => void;
}

export function PrivateChat({
  currentUserId,
  otherUser,
  onClose,
}: PrivateChatProps) {
  const [messages, setMessages] = useState<PrivateMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadMessages();
    if (realtimeConnected) return;
    const interval = setInterval(loadMessages, 8000);
    return () => clearInterval(interval);
  }, [otherUser.id, realtimeConnected]);

  useEffect(() => {
    if (!currentUserId) return;
    connectRealtime(currentUserId);

    const unsubscribeStatus = addRealtimeStatusListener((connected) => {
      setRealtimeConnected(connected);
    });

    const unsubscribeEvents = addRealtimeListener((event) => {
      if (event.type === 'private_message_created' && event.message) {
        const message = event.message as PrivateMessage;
        const isMatch =
          (message.from_user_id === currentUserId && message.to_user_id === otherUser.id) ||
          (message.from_user_id === otherUser.id && message.to_user_id === currentUserId);

        if (isMatch) {
          setMessages((prev) => {
            if (prev.some((msg) => msg.id === message.id)) return prev;
            return [...prev, message];
          });
        }
      }

      if (event.type === 'private_message_expired' && Array.isArray(event.message_ids)) {
        const hasUsers =
          Array.isArray(event.user_ids) &&
          event.user_ids.includes(currentUserId) &&
          event.user_ids.includes(otherUser.id);
        if (hasUsers) {
          setMessages((prev) => prev.filter((msg) => !event.message_ids.includes(msg.id)));
        }
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeEvents();
    };
  }, [currentUserId, otherUser.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    try {
      const res = await fetch(
        `/api/private-messages?from_user_id=${currentUserId}&to_user_id=${otherUser.id}`
      );
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch('/api/private-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from_user_id: currentUserId,
          to_user_id: otherUser.id,
          content: input,
        }),
      });

      if (res.ok) {
        setInput('');
        if (!realtimeConnected) {
          await loadMessages();
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full lg:w-80 bg-[color:var(--panel)] border border-[color:var(--border-strong)] rounded-2xl shadow-lg flex flex-col h-[60vh] lg:h-[500px] overflow-hidden">
      {/* Header */}
      <div className="bg-[color:var(--panel-2)] text-[color:var(--text)] px-4 py-3 flex items-center justify-between border-b border-[color:var(--border-strong)]">
        <div className="flex items-center gap-3">
          {otherUser.profile_image ? (
            <img
              src={otherUser.profile_image}
              alt="Profile"
              className="w-8 h-8 rounded-full object-cover border border-[color:var(--border-strong)]"
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: otherUser.avatar_color }}
            >
              {otherUser.nickname.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h3 className="font-bold text-sm">{otherUser.nickname}</h3>
            <p className="text-xs text-[color:var(--text-muted)]">Direct Message</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="hover:bg-[color:var(--panel-3)] p-1 rounded transition text-[color:var(--text-muted)]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[color:var(--bg)]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-[color:var(--text-subtle)] text-sm">
            Memuat pesan...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[color:var(--text-subtle)] text-sm">
            <MessageCircle className="w-4 h-4 mr-2" />
            Mulai percakapan
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.from_user_id === currentUserId
                    ? 'justify-end'
                    : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                    message.from_user_id === currentUserId
                      ? 'bg-gradient-to-br from-[var(--accent-1)] to-[var(--accent-2)] text-white rounded-br-none'
                      : 'bg-[color:var(--panel-2)] text-[color:var(--text)] rounded-bl-none'
                  }`}
                >
                  <p className="break-words">{message.content}</p>
                  <span className="text-xs opacity-70 mt-1 block">
                    {formatTimeAgo(new Date(message.created_at))}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-[color:var(--border-strong)] px-4 py-3 bg-[color:var(--panel-2)] flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Ketik pesan..."
          className="rounded-lg text-sm bg-[color:var(--panel-2)] border-[color:var(--border-strong)] text-[color:var(--text)] placeholder:text-[color:var(--text-subtle)]"
          disabled={loading}
        />
        <Button
          onClick={handleSendMessage}
          disabled={loading || !input.trim()}
          className="bg-gradient-to-br from-[var(--accent-1)] to-[var(--accent-2)] text-white"
          size="icon"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
