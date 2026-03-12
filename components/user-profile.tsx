'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { LogOut, Settings, Shield } from 'lucide-react';

interface UserProfileProps {
  nickname: string;
  avatarColor: string;
  userId: string;
  onLogout: () => void;
  onClose: () => void;
}

export function UserProfile({
  nickname,
  avatarColor,
  userId,
  onLogout,
  onClose,
}: UserProfileProps) {
  const [profileImage, setProfileImage] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('profile_image');
    if (stored) {
      setProfileImage(stored);
    }
  }, []);

  const compressImage = async (dataUrl: string) => {
    if (typeof window === 'undefined') return dataUrl;

    try {
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('image load failed'));
      });

      const maxSize = 128;
      const side = Math.min(img.width, img.height);
      const sx = Math.max(0, (img.width - side) / 2);
      const sy = Math.max(0, (img.height - side) / 2);

      const canvas = document.createElement('canvas');
      canvas.width = maxSize;
      canvas.height = maxSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return dataUrl;
      ctx.drawImage(img, sx, sy, side, side, 0, 0, maxSize, maxSize);
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch {
      return dataUrl;
    }
  };

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (result) {
        const compressed = await compressImage(result);
        setProfileImage(compressed);
        localStorage.setItem('profile_image', compressed);
        window.dispatchEvent(new Event('profile_image_updated'));

        try {
          await fetch('/api/users/profile-image', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': userId,
            },
            body: JSON.stringify({ profile_image: compressed }),
          });
        } catch (error) {
          console.error('Failed to sync profile image:', error);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const initials = nickname
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-[color:var(--panel)] text-[color:var(--text)] rounded-2xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Profile</h2>
          <button
            onClick={onClose}
            className="text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
          >
            ✕
          </button>
        </div>

        {/* User Info */}
        <div className="text-center mb-8">
          {profileImage ? (
            <img
              src={profileImage}
              alt="Profile"
              className="w-20 h-20 rounded-full object-cover mx-auto mb-4 border border-[color:var(--border-strong)]"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4"
              style={{ backgroundColor: avatarColor }}
            >
              {initials}
            </div>
          )}
          <div className="flex items-center justify-center">
            <label className="text-xs text-[color:var(--text-muted)] border border-[color:var(--border-strong)] bg-[color:var(--panel-2)] px-3 py-1 rounded-full cursor-pointer hover:text-[color:var(--text)]">
              Ganti Foto
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </label>
          </div>
          <h3 className="text-xl font-bold text-[color:var(--text)]">{nickname}</h3>
          <p className="text-sm text-[color:var(--text-muted)]">User ID: {userId.slice(0, 8)}...</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8 p-4 bg-[color:var(--panel-2)] rounded-lg">
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">0</p>
            <p className="text-xs text-[color:var(--text-muted)]">Messages</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">0</p>
            <p className="text-xs text-[color:var(--text-muted)]">Friends</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">0</p>
            <p className="text-xs text-[color:var(--text-muted)]">Rooms</p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start"
            disabled
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            disabled
          >
            <Shield className="w-4 h-4 mr-2" />
            Privacy & Security
          </Button>
          <Button
            variant="destructive"
            className="w-full justify-start"
            onClick={() => {
              onLogout();
              onClose();
            }}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-6 border-t border-[color:var(--border-strong)] text-center">
          <p className="text-xs text-[color:var(--text-muted)]">
            NASIB JADI WNI v1.0 • Anonymous Chat Platform
          </p>
        </div>
      </div>
    </div>
  );
}
