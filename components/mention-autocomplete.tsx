'use client';

import { useState, useEffect, useRef } from 'react';

interface User {
  id: string;
  nickname: string;
  avatar_color: string;
}

interface MentionAutocompleteProps {
  users: User[];
  inputValue: string;
  onSelectMention: (nickname: string) => void;
  visible: boolean;
}

export function MentionAutocomplete({
  users,
  inputValue,
  onSelectMention,
  visible,
}: MentionAutocompleteProps) {
  const [mentions, setMentions] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Check if user is typing a mention
    const lastWord = inputValue.split(/\s/).pop() || '';
    if (lastWord.startsWith('@') && lastWord.length > 1) {
      const searchTerm = lastWord.slice(1).toLowerCase();
      const filtered = users.filter((user) =>
        user.nickname.toLowerCase().includes(searchTerm)
      );
      setMentions(filtered);
      setSelectedIndex(-1);
    } else {
      setMentions([]);
      setSelectedIndex(-1);
    }
  }, [inputValue, users]);

  if (!visible || mentions.length === 0) {
    return null;
  }

  const handleSelect = (user: User) => {
    onSelectMention(user.nickname);
    setMentions([]);
    setSelectedIndex(-1);
  };

  return (
    <div
      ref={dropdownRef}
      className="absolute bottom-full mb-2 w-64 bg-[color:var(--panel)] border border-[color:var(--border-strong)] rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
    >
      {mentions.map((user, index) => (
        <button
          key={user.id}
          onClick={() => handleSelect(user)}
          className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-[color:var(--panel-2)] transition ${
            index === selectedIndex ? 'bg-[color:var(--panel-3)]' : ''
          }`}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: user.avatar_color }}
          >
            {user.nickname.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[color:var(--text)]">
              @{user.nickname}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
