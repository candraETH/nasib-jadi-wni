'use client';

import { useEffect, useState } from 'react';
import { formatTimeAgo } from '@/lib/utils';
import { MessageActions } from './message-actions';

interface User {
  nickname: string;
  avatar_color: string;
  id: string;
  profile_image?: string | null;
}

interface Message {
  id: string;
  content: string;
  users: User;
  created_at: string;
  mentions?: string[] | null;
}

interface MessageItemProps {
  message: Message;
  onMentionClick?: (nickname: string) => void;
  currentUserId?: string;
  roomId?: string;
  onPrivateChat?: (user: User) => void;
}

export function MessageItem({
  message,
  onMentionClick,
  currentUserId,
  roomId,
  onPrivateChat,
}: MessageItemProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [ownProfileImage, setOwnProfileImage] = useState<string | null>(null);
  const timeAgo = formatTimeAgo(new Date(message.created_at));
  const user = message.users;
  const isOwnMessage = currentUserId ? user.id === currentUserId : false;
  const initials = user.nickname
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isAudio = message.content.startsWith('__audio__:');
  const audioSrc = isAudio ? message.content.replace('__audio__:', '') : null;
  const profileImage = user.profile_image || (isOwnMessage ? ownProfileImage : null);

  useEffect(() => {
    if (!isOwnMessage) return;
    const load = () => setOwnProfileImage(localStorage.getItem('profile_image'));
    load();
    const handleProfileImageUpdated = () => load();
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'profile_image') load();
    };
    window.addEventListener('profile_image_updated', handleProfileImageUpdated);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('profile_image_updated', handleProfileImageUpdated);
      window.removeEventListener('storage', handleStorage);
    };
  }, [isOwnMessage]);

  // Parse mentions in content
  const parsedContent = isAudio
    ? null
    : message.content.split(/(@\w+)/g).map((part, idx) => {
        if (part.match(/^@\w+$/)) {
          return (
            <button
              key={idx}
              onClick={() => onMentionClick?.(part.slice(1))}
              className="font-semibold text-[color:var(--blue)] hover:underline cursor-pointer"
            >
              {part}
            </button>
          );
        }
        return part;
      });

  return (
    <div className="flex gap-3 px-3 py-2 rounded-xl hover:bg-[color:var(--panel-2)] transition group">
      {profileImage ? (
        <img
          src={profileImage}
          alt="Profile"
          className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-[color:var(--border-strong)]"
        />
      ) : (
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-xs"
          style={{ backgroundColor: user.avatar_color }}
        >
          {initials}
        </div>
      )}
      
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <button
            type="button"
            onClick={() => {
              if (!isOwnMessage) setShowMenu((prev) => !prev);
            }}
            className="font-semibold text-[color:var(--text)] hover:text-[color:var(--accent-1)]"
          >
            {user.nickname}
          </button>
          {currentUserId && roomId && (
            <MessageActions
              messageId={message.id}
              authorId={user.id}
              currentUserId={currentUserId}
              authorName={user.nickname}
              roomId={roomId}
              onPrivateChat={
                user.id && user.id !== currentUserId && onPrivateChat
                  ? () => onPrivateChat(user)
                  : undefined
              }
              open={showMenu}
              onOpenChange={setShowMenu}
              showTrigger={false}
            />
          )}
          <span className="text-[10px] text-[color:var(--text-subtle)] font-mono">{timeAgo}</span>
        </div>

        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {isAudio && audioSrc ? (
              <audio
                controls
                preload="none"
                src={audioSrc}
                className="njw-audio w-full max-w-[420px]"
              />
            ) : (
              <p className="text-sm text-[color:var(--text-muted)] break-words">{parsedContent}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
