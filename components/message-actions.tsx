'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Ban, MoreHorizontal, Flag, MessageCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface MessageActionsProps {
  messageId: string;
  authorId: string;
  currentUserId: string;
  authorName: string;
  roomId: string;
  onPrivateChat?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showTrigger?: boolean;
}

export function MessageActions({
  messageId,
  authorId,
  currentUserId,
  authorName,
  roomId,
  onPrivateChat,
  open,
  onOpenChange,
  showTrigger = true,
}: MessageActionsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const isControlled = typeof open === 'boolean';
  const showMenu = isControlled ? open : internalOpen;
  const setShowMenu = (next: boolean) => {
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
  };

  const isOwnMessage = authorId === currentUserId;

  useEffect(() => {
    if (!showMenu || showReportForm) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!containerRef.current) return;
      if (containerRef.current.contains(target)) return;
      setShowMenu(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowMenu(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMenu, showReportForm]);

  const handleReport = async () => {
    if (!reason.trim()) {
      setMessage('Silakan masukkan alasan');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'report',
          messageId,
          targetUserId: authorId,
          moderatorId: currentUserId,
          roomId,
          reason,
        }),
      });

      if (res.ok) {
        setMessage('Laporan berhasil dikirim');
        setReason('');
        setShowReportForm(false);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('Gagal mengirim laporan');
      console.error('Report error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/moderation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'block',
          targetUserId: authorId,
          moderatorId: currentUserId,
        }),
      });

      if (res.ok) {
        setMessage(`${authorName} telah diblokir`);
        setShowMenu(false);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('Gagal memblokir user');
      console.error('Block error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {message && (
        <Alert className="mb-2 border-[color:var(--border-strong)] bg-[color:var(--panel-2)] text-[color:var(--text)]">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      {showTrigger && (
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1 hover:bg-[color:var(--panel-2)] rounded transition"
        >
          <MoreHorizontal className="w-4 h-4 text-[color:var(--text-muted)]" />
        </button>
      )}

      {showMenu && (
        <div className="absolute left-0 bottom-full mb-2 min-w-[200px] bg-[color:var(--panel)] border border-[color:var(--border-strong)] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.35)] z-10 overflow-hidden">
          {!isOwnMessage && (
            <>
              {onPrivateChat && (
                <button
                  onClick={() => {
                    onPrivateChat();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-[color:var(--text)] hover:bg-[color:var(--panel-2)] transition"
                >
                  <MessageCircle className="w-4 h-4" />
                  Pesan Pribadi
                </button>
              )}
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowReportForm(true);
                }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-red-400 hover:bg-[color:var(--panel-2)] transition"
              >
                <Flag className="w-4 h-4" />
                Laporkan Pesan
              </button>
              <button
                onClick={handleBlock}
                disabled={loading}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-orange-400 hover:bg-[color:var(--panel-2)] transition disabled:opacity-50"
              >
                <Ban className="w-4 h-4" />
                Blokir {authorName}
              </button>
            </>
          )}
        </div>
      )}

      {showReportForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[color:var(--panel)] border border-[color:var(--border-strong)] rounded-lg p-6 w-full max-w-sm text-[color:var(--text)]">
            <h3 className="text-lg font-bold mb-4">Laporkan Pesan</h3>
            <p className="text-sm text-[color:var(--text-muted)] mb-4">
              Lapor pesan dari <strong>{authorName}</strong>
            </p>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Jelaskan alasan melaporkan..."
              className="w-full border border-[color:var(--border-strong)] bg-[color:var(--panel-2)] text-[color:var(--text)] rounded-lg p-3 text-sm resize-none h-24 mb-4"
              maxLength={200}
            />

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowReportForm(false)}
                disabled={loading}
              >
                Batal
              </Button>
              <Button
                onClick={handleReport}
                disabled={loading || !reason.trim()}
                className="flex-1"
              >
                {loading ? 'Mengirim...' : 'Kirim Laporan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
