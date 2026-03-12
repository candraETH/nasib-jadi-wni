import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'Baru saja';
  } else if (diffMins < 60) {
    return `${diffMins}m lalu`;
  } else if (diffHours < 24) {
    return `${diffHours}h lalu`;
  } else if (diffDays < 7) {
    return `${diffDays}d lalu`;
  } else {
    return date.toLocaleDateString('id-ID');
  }
}
