'use client';

import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

interface User {
  id: string;
  nickname: string;
  avatar_color: string;
  profile_image?: string | null;
}

interface OnlineUsersProps {
  users: User[];
  userId: string;
  onPrivateChat?: (user: User) => void;
}

export function OnlineUsers({ users, userId, onPrivateChat }: OnlineUsersProps) {
  const getInitials = (nickname: string) => {
    return nickname
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 1);
  };

  const otherUsers = users.filter((u) => u.id !== userId);

  return (
    <div className="w-full lg:w-64 bg-[color:var(--panel)] border border-[color:var(--border-strong)] rounded-2xl p-4 flex flex-col max-h-[60vh] lg:max-h-96">
      <h3 className="font-bold text-[color:var(--text)] mb-4">
        {otherUsers.length} Online
      </h3>

      <div className="flex-1 overflow-y-auto space-y-2">
        {otherUsers.length === 0 ? (
          <p className="text-sm text-[color:var(--text-subtle)] text-center py-4">
            Tidak ada user lain online
          </p>
        ) : (
          otherUsers.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-2 p-2 hover:bg-[color:var(--panel-2)] rounded-lg cursor-pointer transition"
              onClick={() => onPrivateChat?.(user)}
            >
              {user.profile_image ? (
                <img
                  src={user.profile_image}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-[color:var(--border-strong)]"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: user.avatar_color }}
                >
                  {getInitials(user.nickname)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[color:var(--text)] truncate">
                  {user.nickname}
                </p>
                <p className="text-xs text-[color:var(--success)]">(Online)</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onPrivateChat?.(user);
                }}
                className="w-6 h-6 flex-shrink-0 text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
              >
                <MessageCircle className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
