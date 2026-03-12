'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Header } from '@/components/header';
import { ChatRoom } from '@/components/chat-room';
import { UserProfile } from '@/components/user-profile';
import { AlertCircle, BookOpen, Moon, Sun } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  addRealtimeListener,
  addRealtimeStatusListener,
  connectRealtime,
} from '@/lib/realtime-client';

interface Room {
  id: string;
  name: string;
  category: string;
  member_count: number;
  emoji: string;
}

interface User {
  nickname: string;
  avatar_color: string;
  id: string;
}

const DEFAULT_ROOMS: Room[] = [
  {
    id: 'curhat',
    name: 'Curhat WNI',
    category: 'general',
    member_count: 2193,
    emoji: '\u{1F525}',
  },
  {
    id: 'ngoding',
    name: 'Ngoding',
    category: 'tech',
    member_count: 896,
    emoji: '\u{1F4BB}',
  },
  {
    id: 'olahraga',
    name: 'Olahraga',
    category: 'sports',
    member_count: 891,
    emoji: '\u{26BD}',
  },
  {
    id: 'gaming',
    name: 'Gaming',
    category: 'gaming',
    member_count: 1042,
    emoji: '\u{1F3AE}',
  },
  {
    id: 'relationship',
    name: 'Relationship',
    category: 'general',
    member_count: 3193,
    emoji: '\u{1F4AC}',
  },
  {
    id: 'random',
    name: 'Random Room',
    category: 'general',
    member_count: 1761,
    emoji: '\u{1F3B2}',
  },
];

const ROOM_EMOJIS: Record<string, string> = {
  curhat: '\u{1F525}',
  ngoding: '\u{1F4BB}',
  olahraga: '\u{26BD}',
  gaming: '\u{1F3AE}',
  relationship: '\u{1F4AC}',
  random: '\u{1F3B2}',
  politik: '\u{1F3DB}\u{FE0F}',
};

const ROOM_DESCRIPTIONS: Record<string, string> = {
  curhat: 'Cerita, keluhan, curhat bebas',
  ngoding: 'Diskusi kode & teknologi',
  olahraga: 'Sepak bola, badminton, dan lainnya',
  gaming: 'Game PC, mobile, console',
  relationship: 'Bahas relasi & perasaan',
  random: 'Ngobrol apa aja bebas',
  politik: 'Diskusi isu nasional',
};

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [nickname, setNickname] = useState('');
  const [userId, setUserId] = useState('');
  const [activeRoom, setActiveRoom] = useState('curhat');
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [onlineCount, setOnlineCount] = useState(2984);
  const [onlineUsers, setOnlineUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [avatarColor, setAvatarColor] = useState('#3B82F6');
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [view, setView] = useState<'lobby' | 'chat'>('lobby');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showGuide, setShowGuide] = useState(false);
  const onlineRefreshTimer = useRef<number | null>(null);

  const syncProfileImage = async (id: string) => {
    if (typeof window === 'undefined') return;
    const profileImage = localStorage.getItem('profile_image');
    if (!profileImage) return;
    try {
      await fetch('/api/users/profile-image', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': id,
        },
        body: JSON.stringify({ profile_image: profileImage }),
      });
    } catch (error) {
      console.error('Failed to sync profile image:', error);
    }
  };

  // Check if user is already logged in and load rooms
  useEffect(() => {
    const storedNickname = localStorage.getItem('nickname');
    const storedUserId = localStorage.getItem('user_id');
    const storedColor = localStorage.getItem('avatar_color');
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark' || storedTheme === 'light') {
      setTheme(storedTheme);
    }
    if (storedNickname && storedUserId) {
      setNickname(storedNickname);
      setUserId(storedUserId);
      if (storedColor) setAvatarColor(storedColor);
      setIsLoggedIn(true);
      setView('lobby');
      loadRooms();
      loadOnlineUsers();
      void syncProfileImage(storedUserId);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const loadRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      const rooms = await res.json();
      const mappedRooms = rooms.map((room: any) => ({
        id: room.id,
        name: room.name,
        category: room.category,
        member_count: room.member_count || 0,
        emoji: room.icon || ROOM_EMOJIS[room.id] || '\u{1F4AC}',
      }));
      setRooms(mappedRooms);
      if (mappedRooms.length > 0) {
        setActiveRoom(mappedRooms[0].id);
      }
    } catch (error) {
      console.error('Failed to load rooms:', error);
    }
  };

  // Poll online users
  useEffect(() => {
    if (isLoggedIn) {
      loadOnlineUsers();
      const intervalMs = realtimeConnected ? 15000 : 5000;
      const interval = setInterval(loadOnlineUsers, intervalMs);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn, realtimeConnected, userId]);

  useEffect(() => {
    if (!isLoggedIn || !userId) return;
    connectRealtime(userId);

    const unsubscribeStatus = addRealtimeStatusListener((connected) => {
      setRealtimeConnected(connected);
    });

    const scheduleOnlineRefresh = () => {
      if (onlineRefreshTimer.current) return;
      onlineRefreshTimer.current = window.setTimeout(() => {
        onlineRefreshTimer.current = null;
        loadOnlineUsers();
      }, 300);
    };

    const unsubscribeEvents = addRealtimeListener((event) => {
      if (event.type === 'room_join' || event.type === 'room_leave') {
        if (event.room_id && typeof event.online_count === 'number') {
          setRooms((prev) =>
            prev.map((room) =>
              room.id === event.room_id
                ? { ...room, member_count: event.online_count }
                : room
            )
          );
        }
        scheduleOnlineRefresh();
      }

      if (event.type === 'room_created' && event.room) {
        setRooms((prev) => {
          if (prev.some((room) => room.id === event.room.id)) return prev;
          return [
            ...prev,
            {
              id: event.room.id,
              name: event.room.name,
              category: event.room.category,
              member_count: event.room.member_count || 0,
              emoji: event.room.icon || ROOM_EMOJIS[event.room.id] || '\u{1F4AC}',
            },
          ];
        });
      }

      if (event.type === 'user_status') {
        scheduleOnlineRefresh();
      }

      if (event.type === 'user_profile_image_updated') {
        scheduleOnlineRefresh();
      }
    });

    return () => {
      unsubscribeStatus();
      unsubscribeEvents();
      if (onlineRefreshTimer.current) {
        window.clearTimeout(onlineRefreshTimer.current);
        onlineRefreshTimer.current = null;
      }
    };
  }, [isLoggedIn, userId]);

  const loadOnlineUsers = async () => {
    try {
      const res = await fetch('/api/users/online', {
        headers: userId ? { 'x-user-id': userId } : undefined,
      });
      const data = await res.json();
      setOnlineUsers(data.users || []);
      setOnlineCount(data.count || 0);
    } catch (error) {
      console.error('Failed to load online users:', error);
    }
  };

  const formatOnlineCount = (count: number) => {
    return Number.isFinite(count) ? count.toLocaleString('id-ID') : '0';
  };

  const getRoomDescription = (room: Room) => {
    return ROOM_DESCRIPTIONS[room.id] || 'Ngobrol santai bareng yang lain';
  };

  const getRoomEmoji = (room: Room) => {
    return room.emoji || ROOM_EMOJIS[room.id] || '\u{1F4AC}';
  };

  const handleRoomSelect = (roomId: string) => {
    setActiveRoom(roomId);
    setView('chat');
  };

  const handleBackToLobby = () => {
    setView('lobby');
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNickname = nickname.trim();
    if (!cleanNickname) {
      setError('Nickname tidak boleh kosong');
      return;
    }
    if (/\s/.test(cleanNickname)) {
      setError('Nickname tidak boleh mengandung spasi');
      return;
    }
    if (cleanNickname.length < 4) {
      setError('Nickname minimal 4 karakter');
      return;
    }
    if (!/[a-zA-Z]/.test(cleanNickname) || !/[0-9]/.test(cleanNickname)) {
      setError('Nickname harus mengandung huruf dan angka');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: cleanNickname }),
      });

      if (!res.ok) {
        throw new Error('Login failed');
      }

      const user = await res.json();
      setUserId(user.id);
      setAvatarColor(user.avatar_color);
      localStorage.setItem('nickname', user.nickname);
      localStorage.setItem('user_id', user.id);
      localStorage.setItem('avatar_color', user.avatar_color);
      setIsLoggedIn(true);
      setView('lobby');
      loadRooms();
      loadOnlineUsers();
      void syncProfileImage(user.id);
    } catch (err) {
      setError('Terjadi kesalahan. Silakan coba lagi.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/rooms/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, room_id: activeRoom }),
      });

      await fetch('/api/auth', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, status: 'offline' }),
      });

      localStorage.removeItem('nickname');
      localStorage.removeItem('user_id');
      setNickname('');
      setUserId('');
      setIsLoggedIn(false);
      setView('lobby');
      setOnlineUsers([]);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    if (!isLoggedIn || !userId || !activeRoom) return;
    fetch('/api/rooms/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, room_id: activeRoom }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (payload?.room_id && typeof payload.online_count === 'number') {
          setRooms((prev) =>
            prev.map((room) =>
              room.id === payload.room_id
                ? { ...room, member_count: payload.online_count }
                : room
            )
          );
        }
      })
      .catch((error) => {
        console.error('Failed to join room:', error);
      });
  }, [isLoggedIn, userId, activeRoom]);

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen relative flex items-center justify-center px-4 bg-[color:var(--bg)] text-[color:var(--text)] overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_40%,var(--hero-glow)_0%,var(--bg)_70%)]" />
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--hero-glow)_0%,transparent_70%)]" />
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          className="absolute top-6 right-6 z-10 flex items-center gap-2 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--panel)] px-3 py-2 text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
        >
          {theme === 'dark' ? (
            <Moon className="h-4 w-4" />
          ) : (
            <Sun className="h-4 w-4" />
          )}
          <span>Mode: {theme === 'dark' ? 'Gelap' : 'Terang'}</span>
        </button>

        <Card className="relative w-full max-w-md gap-0 border border-[color:var(--border-strong)] bg-[color:var(--panel)] p-10 shadow-[0_40px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.04)]">
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="absolute right-6 top-6 h-9 w-9 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--panel-2)] text-[#f5c542] shadow-[0_0_18px_rgba(245,197,66,0.6)] hover:bg-[color:var(--panel-3)] flex items-center justify-center"
            aria-label="Panduan & Aturan"
          >
            <BookOpen className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-[14px] border border-[color:var(--border-strong)] bg-[linear-gradient(180deg,#e8451a_0%,#e8451a_50%,#ffffff_50%,#ffffff_100%)] shadow-[0_8px_24px_var(--accent-glow)]" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-[-0.5px] bg-gradient-to-r from-red-600 via-red-600 to-white text-transparent bg-clip-text drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]">
                  NASIB JADI WNI
                </h1>
              </div>
              <span className="text-xs text-[color:var(--text-muted)]">
                Keluh Kesah Jadi WNI
              </span>
            </div>
          </div>

          <p className="text-sm text-[color:var(--text-muted)] leading-relaxed mb-6">
            Ruang ngobrol bebas untuk semua WNI. Pilih room, ketemu orang baru,
            mulai ngobrol!
          </p>

          {error && (
            <Alert
              variant="destructive"
              className="mb-4 border-[#ff6b6b]/40 bg-[#ff6b6b]/10 text-[#ffd7d7]"
            >
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[11px] font-bold tracking-[1.5px] uppercase text-[color:var(--text-muted)] mb-2">
                Nickname kamu
              </label>
              <Input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Masukkan nama..."
                className="h-12 rounded-[12px] bg-[color:var(--panel-2)] border-[color:var(--border-strong)] text-[color:var(--text)] placeholder:text-[color:var(--text-subtle)] font-semibold focus-visible:border-[color:var(--accent-1)] focus-visible:ring-2 focus-visible:ring-[color:var(--accent-1)]"
                disabled={loading}
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full rounded-[12px] bg-gradient-to-br from-[var(--accent-1)] to-[var(--accent-2)] text-white font-bold shadow-[0_4px_20px_var(--accent-glow)] hover:shadow-[0_8px_28px_var(--accent-glow)] transition"
            >
              {loading ? 'Memproses...' : 'Masuk ke Chat ->'}
            </Button>

            <div className="flex items-center justify-center gap-2 text-xs text-[color:var(--text-muted)]">
              <span className="h-2 w-2 rounded-full bg-[color:var(--success)]" />
              <span>{onlineCount.toLocaleString()} orang online sekarang</span>
            </div>
          </form>
        </Card>

        {showGuide && (
          <div
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4"
            onClick={() => setShowGuide(false)}
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-[color:var(--border-strong)] bg-[color:var(--panel)] p-6 text-[color:var(--text)] shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">Panduan & Aturan</h3>
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-sm text-[color:var(--text-muted)]">
                <p>
                  Ini ruang chat bebas. Kamu tidak perlu email atau nomor HP.
                  Semua chat bersifat anonim dan identitas kamu tidak ditampilkan.
                </p>
                <p className="text-[color:var(--text)] font-semibold">Aturan & Larangan</p>
                <p>1. Dilarang menyebar data pribadi (doxxing) atau identitas orang lain.</p>
                <p>2. Dilarang ujaran kebencian, pelecehan, ancaman, atau intimidasi.</p>
                <p>3. Dilarang spam, promosi, penipuan, atau link berbahaya.</p>
                <p>4. Dilarang konten ilegal, pornografi, atau eksploitasi anak.</p>
                <p>5. Hormati pengguna lain dan jaga privasi.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main Chat Screen
  return (
    <main className="min-h-screen bg-[color:var(--bg)] text-[color:var(--text)]">
      <Header
        nickname={nickname}
        onLogout={handleLogout}
        onProfileClick={() => setShowProfile(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {view === 'lobby' ? (
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="mb-8">
            <h2 className="text-2xl font-bold">
              Pilih Room <span className="text-base">{'\u{1F44B}'}</span>
            </h2>
            <p className="text-sm text-[color:var(--text-muted)]">
              Pilih room yang kamu mau masuki dan mulai ngobrol
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => handleRoomSelect(room.id)}
                className="text-left border border-[color:var(--border-strong)] bg-[color:var(--panel)] rounded-2xl p-6 transition hover:border-[color:var(--accent-1)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.35)]"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--panel-2)] text-2xl shadow-[0_10px_24px_rgba(0,0,0,0.2)]">
                  {getRoomEmoji(room)}
                </div>
                <div className="text-base font-semibold mb-2">{room.name}</div>
                <div className="text-xs text-[color:var(--success)] font-mono mb-2">
                  {'\u{25CF}'} {formatOnlineCount(room.member_count)} online
                </div>
                <div className="text-xs text-[color:var(--text-muted)]">
                  {getRoomDescription(room)}
                </div>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <ChatRoom
            roomId={activeRoom}
            roomName={rooms.find((r) => r.id === activeRoom)?.name || 'Room'}
            roomEmoji={getRoomEmoji(
              rooms.find((r) => r.id === activeRoom) || {
                id: '',
                name: '',
                category: '',
                member_count: 0,
                emoji: '\u{1F4AC}',
              }
            )}
            userId={userId}
            onlineCount={
              rooms.find((r) => r.id === activeRoom)?.member_count || onlineCount
            }
            onlineUsers={onlineUsers}
            onBackToLobby={handleBackToLobby}
          />
        </section>
      )}

      {showProfile && (
        <UserProfile
          nickname={nickname}
          avatarColor={avatarColor}
          userId={userId}
          onLogout={handleLogout}
          onClose={() => setShowProfile(false)}
        />
      )}
    </main>
  );
}
