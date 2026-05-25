import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combine and de-dupe Tailwind classes. Used by shadcn/ui components and
 * anywhere we conditionally apply utility classes.
 *
 *   cn('p-4', isActive && 'bg-brand-red', extraClass)
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
