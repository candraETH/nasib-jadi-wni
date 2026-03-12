'use client';

interface Room {
  id: string;
  name: string;
  icon?: string;
  member_count: number;
  emoji: string;
}

interface RoomTabsProps {
  rooms: Room[];
  activeRoom: string;
  onRoomChange: (roomId: string) => void;
}

export function RoomTabs({ rooms, activeRoom, onRoomChange }: RoomTabsProps) {
  return (
    <aside className="w-full lg:w-64 bg-[color:var(--panel)] border border-[color:var(--border-strong)] rounded-2xl overflow-hidden flex flex-col h-auto lg:h-[calc(100vh-200px)]">
      <div className="px-4 py-4 border-b border-[color:var(--border-strong)] flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-1)] to-[var(--accent-2)] text-white flex items-center justify-center text-xs font-bold">
          ID
        </div>
        <div>
          <div className="text-sm font-bold">NASIB JADI WNI</div>
          <div className="text-[10px] text-[color:var(--text-muted)]">
            Keluh Kesah Jadi WNI
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 text-[10px] uppercase tracking-[1.5px] text-[color:var(--text-subtle)]">
        Rooms
      </div>
      <div className="px-2 py-3 space-y-1 overflow-y-auto">
        {rooms.map((room) => {
          const isActive = activeRoom === room.id;
          return (
            <button
              key={room.id}
              onClick={() => onRoomChange(room.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition ${
                isActive
                  ? 'bg-[color:var(--panel-2)] text-[color:var(--text)] border border-[color:var(--accent-1)] shadow-[0_8px_24px_rgba(0,0,0,0.2)]'
                  : 'text-[color:var(--text-muted)] hover:text-[color:var(--text)] hover:bg-[color:var(--panel-2)]'
              }`}
            >
              <span className="text-lg">{room.emoji || room.icon || '💬'}</span>
              <span className="flex-1 text-sm font-semibold truncate">{room.name}</span>
              <span className="text-[10px] font-mono text-[color:var(--text-subtle)]">
                {((room.member_count || 0) / 1000).toFixed(1)}k
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto px-4 pb-4">
        <div className="text-[10px] uppercase tracking-[1.5px] text-[color:var(--text-subtle)] mb-2">
          Pesan Langsung
        </div>
        <div className="text-xs text-[color:var(--text-subtle)]">Belum ada pesan</div>
      </div>
    </aside>
  );
}
