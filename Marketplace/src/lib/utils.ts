/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - new Date(date).getTime();
  const diffInSecs = Math.floor(diffInMs / 1000);
  const diffInMins = Math.floor(diffInSecs / 60);
  const diffInHours = Math.floor(diffInMins / 60);
  const diffInDays = Math.floor(diffInHours / 24);

  if (diffInSecs < 60) {
    return 'Agora';
  } else if (diffInMins < 60) {
    return `Há ${diffInMins} min`;
  } else if (diffInHours < 24) {
    return `Há ${diffInHours}h`;
  } else if (diffInDays < 7) {
    return `Há ${diffInDays} dias`;
  } else {
    return new Date(date).toLocaleDateString('pt-PT', {
      day: 'numeric',
      month: 'short'
    });
  }
}
