'use client';

import { useEffect, useState } from 'react';

interface Room {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  online_count: number;
  is_public: boolean;
  member_count?: number;
}

export function useRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadRooms = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) throw new Error('Failed to fetch rooms');
      const data = await res.json();
      setRooms(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  return {
    rooms,
    isLoading,
    error,
    mutate: loadRooms,
  };
}
