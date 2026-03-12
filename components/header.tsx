'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, LogOut, Moon, Sun } from 'lucide-react';

interface HeaderProps {
  nickname: string;
  onLogout: () => void;
  onProfileClick?: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
}

export function Header({
  nickname,
  onLogout,
  onProfileClick,
  theme,
  onToggleTheme,
}: HeaderProps) {
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('profile_image');
    if (stored) {
      setProfileImage(stored);
    }

    const handleProfileImageUpdated = () => {
      setProfileImage(localStorage.getItem('profile_image'));
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'profile_image') {
        setProfileImage(event.newValue);
      }
    };
    window.addEventListener('profile_image_updated', handleProfileImageUpdated);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('profile_image_updated', handleProfileImageUpdated);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return (
    <header className="bg-[color:var(--panel)] border-b border-[color:var(--border-strong)] text-[color:var(--text)] py-4">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl border border-[color:var(--border-strong)] bg-[linear-gradient(180deg,#e8451a_0%,#e8451a_50%,#ffffff_50%,#ffffff_100%)] shadow-[0_8px_24px_var(--accent-glow)]" />
              <div>
                <div className="text-base font-extrabold tracking-[-0.3px]">
                  <span className="bg-gradient-to-r from-red-600 via-red-600 to-white text-transparent bg-clip-text drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]">
                    NASIB JADI WNI
                  </span>
                </div>
                <div className="text-[10px] text-[color:var(--text-muted)]">
                  Keluh Kesah Jadi WNI
                </div>
              </div>
            </div>

            <div className="flex items-start justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="gap-2 bg-[color:var(--panel-2)] text-[color:var(--text)] border border-[color:var(--border-strong)] hover:bg-[color:var(--panel-3)]"
                  >
                    {profileImage ? (
                      <img
                        src={profileImage}
                        alt="Profile"
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold bg-gradient-to-br from-[var(--accent-1)] to-[var(--accent-2)]">
                        {nickname.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span>{nickname}</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onProfileClick}>
                    Logged in as <strong>{nickname}</strong>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onLogout} className="text-red-600">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            className="w-fit flex items-center gap-2 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--panel-2)] px-3 py-2 text-xs text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
          >
            {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            <span>Mode: {theme === 'dark' ? 'Gelap' : 'Terang'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
