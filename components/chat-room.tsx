'use client';

import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mic, Send, Smile } from 'lucide-react';
import { MessageItem } from './message-item';
import { OnlineUsers } from './online-users';
import { PrivateChat } from './private-chat';
import { useMessages } from '@/hooks/use-messages';

interface User {
  nickname: string;
  avatar_color: string;
  id: string;
  profile_image?: string | null;
}

interface Message {
  id: string;
  content: string;
  sender: User;
  created_at: string;
  mentions?: string[];
}

interface ChatRoomProps {
  roomId: string;
  roomName: string;
  roomEmoji?: string;
  userId: string;
  onlineCount: number;
  onlineUsers: User[];
  onBackToLobby?: () => void;
}

export function ChatRoom({
  roomId,
  roomName,
  roomEmoji,
  userId,
  onlineCount,
  onlineUsers,
  onBackToLobby,
}: ChatRoomProps) {
  const COOLDOWN_MS = 15000;
  const RECORD_MAX_SEC = 5;
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOnlineUsers, setShowOnlineUsers] = useState(false);
  const [selectedPrivateUser, setSelectedPrivateUser] = useState<User | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecondsLeft, setRecordSecondsLeft] = useState(RECORD_MAX_SEC);
  const [recordError, setRecordError] = useState('');
  const emojiPanelRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const recordTimeoutRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { messages, sendMessage, isLoading } = useMessages(roomId, userId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const handleClick = (event: MouseEvent) => {
      if (!emojiPanelRef.current) return;
      if (emojiPanelRef.current.contains(event.target as Node)) return;
      setShowEmojiPicker(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmojiPicker]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
      if (recordTimeoutRef.current) window.clearTimeout(recordTimeoutRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (!cooldownUntil) {
      setCooldownRemaining(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, cooldownUntil - Date.now());
      setCooldownRemaining(remaining);
      if (remaining <= 0) {
        setCooldownUntil(null);
      }
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [cooldownUntil]);

  const handleSendMessage = async () => {
    if (!input.trim() || !userId || loading) return;
    if (cooldownRemaining > 0) return;

    setLoading(true);
    const result = await sendMessage(input, userId);
    if (result.success) setInput('');
    if (result.success) setCooldownUntil(Date.now() + COOLDOWN_MS);
    if (!result.success && result.retryAfterMs) setCooldownUntil(Date.now() + result.retryAfterMs);
    setLoading(false);
  };

  const EMOJIS = [
    '\u{1F600}', '\u{1F601}', '\u{1F602}', '\u{1F923}', '\u{1F60A}', '\u{1F60D}', '\u{1F60E}', '\u{1F622}',
    '\u{1F621}', '\u{1F914}', '\u{1F643}', '\u{1F634}', '\u{1F605}', '\u{1F607}', '\u{1F972}', '\u{1F929}',
    '\u{1F44D}', '\u{1F44E}', '\u{1F64F}', '\u{1F525}', '\u{1F389}', '\u{1F4AF}', '\u{2764}\u{FE0F}', '\u{2728}',
  ];

  const addEmoji = (emoji: string) => {
    setInput((prev) => `${prev}${emoji}`);
    setShowEmojiPicker(false);
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const startRecording = async () => {
    if (cooldownRemaining > 0 || loading) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setRecordError('Voice chat tidak didukung di perangkat ini.');
      return;
    }
    setRecordError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        if (recordTimerRef.current) window.clearInterval(recordTimerRef.current);
        if (recordTimeoutRef.current) window.clearTimeout(recordTimeoutRef.current);
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((track) => track.stop());
          mediaStreamRef.current = null;
        }
        if (chunks.length === 0 || !userId) return;

        const blob = new Blob(chunks, { type: 'audio/webm' });
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.readAsDataURL(blob);
        });

        setLoading(true);
        const result = await sendMessage(`__audio__:${dataUrl}`, userId);
        if (result.success) setCooldownUntil(Date.now() + COOLDOWN_MS);
        if (!result.success && result.retryAfterMs) {
          setCooldownUntil(Date.now() + result.retryAfterMs);
        }
        setLoading(false);
      };

      recorder.start();
      setIsRecording(true);
      setRecordSecondsLeft(RECORD_MAX_SEC);

      recordTimerRef.current = window.setInterval(() => {
        setRecordSecondsLeft((prev) => (prev > 1 ? prev - 1 : 1));
      }, 1000);

      recordTimeoutRef.current = window.setTimeout(() => {
        stopRecording();
      }, RECORD_MAX_SEC * 1000);
    } catch (error) {
      setRecordError('Izin mikrofon ditolak.');
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start justify-center">
      {/* Chat Area */}
      <div className="w-full lg:w-[560px] lg:max-w-[560px] flex flex-col bg-[color:var(--panel)] border border-[color:var(--border-strong)] rounded-2xl overflow-hidden h-[calc(100dvh-120px)] sm:h-[calc(100dvh-200px)] lg:h-[calc(100vh-200px)]">
        {/* Room Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between border-b border-[color:var(--border-strong)] bg-[color:var(--panel-2)]">
          <div className="flex items-center gap-3">
            <div className="text-xl">{roomEmoji || '💬'}</div>
            <div>
              <h2 className="text-base font-bold">{roomName}</h2>
              <div className="text-xs text-[color:var(--success)] font-mono">
                {onlineCount.toLocaleString('id-ID')} online
              </div>
            </div>
          </div>
          {onBackToLobby && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBackToLobby}
              className="text-xs border-[color:var(--border-strong)] text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
            >
              Ganti Room
            </Button>
          )}
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-2">
          <div className="flex items-center gap-3 text-[10px] uppercase tracking-[1.5px] text-[color:var(--text-subtle)] mb-3">
            <div className="h-px flex-1 bg-[color:var(--border-strong)]" />
            <span>Hari ini</span>
            <div className="h-px flex-1 bg-[color:var(--border-strong)]" />
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-full text-[color:var(--text-subtle)]">
              Memuat pesan...
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[color:var(--text-subtle)]">
              Belum ada pesan. Mulai obrolan sekarang!
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  currentUserId={userId}
                  roomId={roomId}
                  onMentionClick={(nickname) => {
                    setInput(`@${nickname} ${input}`);
                  }}
                  onPrivateChat={(user) => {
                    setSelectedPrivateUser(user);
                  }}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-[color:var(--border-strong)] p-3 sm:p-4 space-y-3 bg-[color:var(--panel-2)]">
          <div className="relative flex gap-2 items-end bg-[color:var(--panel-2)] border border-[color:var(--border-strong)] rounded-xl px-3 py-2 focus-within:border-[color:var(--accent-1)] focus-within:shadow-[0_0_0_3px_var(--accent-glow)]">
            <Button
              variant="ghost"
              size="icon"
              className="text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
              onClick={() => setShowEmojiPicker((prev) => !prev)}
              type="button"
            >
              <Smile className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={`text-[color:var(--text-muted)] hover:text-[color:var(--text)] ${
                isRecording ? 'text-red-400' : ''
              }`}
              onClick={() => {
                if (isRecording) stopRecording();
                else void startRecording();
              }}
              type="button"
            >
              <Mic className="w-5 h-5" />
            </Button>
            {showEmojiPicker && (
              <div
                ref={emojiPanelRef}
                className="absolute bottom-full left-2 mb-2 w-56 rounded-xl border border-[color:var(--border-strong)] bg-[color:var(--panel)] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
              >
                <div className="grid grid-cols-8 gap-1">
                  {EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => addEmoji(emoji)}
                      className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[color:var(--panel-2)]"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex-1">
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
                className="border-0 bg-transparent px-0 text-sm text-[color:var(--text)] placeholder:text-[color:var(--text-subtle)] shadow-none focus-visible:ring-0 focus-visible:border-transparent"
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={loading || !input.trim() || cooldownRemaining > 0}
              className="bg-gradient-to-br from-[var(--accent-1)] to-[var(--accent-2)] text-white shadow-[0_4px_20px_var(--accent-glow)] hover:shadow-[0_8px_28px_var(--accent-glow)]"
              size="icon"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-[color:var(--text-muted)]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="rounded accent-[color:var(--accent-1)]"
                checked
                readOnly
              />
              Mode Lambat
              <span className="bg-[color:var(--panel-2)] text-[color:var(--warning)] border border-[color:var(--border-strong)] rounded px-2 py-1 ml-1 font-mono">
                15 detik
              </span>
            </label>
            {isRecording ? (
              <span className="text-[10px] text-red-400 font-mono">
                Merekam {recordSecondsLeft} detik
              </span>
            ) : cooldownRemaining > 0 ? (
              <span className="text-[10px] text-[color:var(--text-subtle)] font-mono">
                Tunggu {Math.ceil(cooldownRemaining / 1000)} detik lagi
              </span>
            ) : null}
          </div>
          {recordError && (
            <div className="text-[10px] text-red-400">{recordError}</div>
          )}

          <div className="flex gap-2 text-xs">
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-[color:var(--border-strong)] text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
            >
              {'\u{2713}'} Tetap Sopan & Jaga Privasi Anda
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-[color:var(--border-strong)] text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
            >
              {'\u{1F6E1}\u{FE0F}'} Laporan
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs bg-[color:var(--panel-2)] text-[color:var(--text)] hover:bg-[color:var(--panel-3)] rounded-full"
              onClick={() => setShowOnlineUsers(!showOnlineUsers)}
            >
              {'\u{25CF}'} Private Msg
            </Button>
          </div>
        </div>
      </div>

      {/* Online Users / Private Chat */}
      <div className="w-full lg:w-80 flex flex-col gap-4">
        {showOnlineUsers && (
          <OnlineUsers 
            users={onlineUsers} 
            userId={userId}
            onPrivateChat={setSelectedPrivateUser}
          />
        )}
        {selectedPrivateUser && (
          <PrivateChat
            currentUserId={userId}
            otherUser={selectedPrivateUser}
            onClose={() => setSelectedPrivateUser(null)}
          />
        )}
      </div>
    </div>
  );
}
