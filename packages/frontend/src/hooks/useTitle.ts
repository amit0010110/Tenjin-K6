import { useEffect } from 'react';

export function useTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ? `${title} — TenjinT6` : 'TenjinT6';
    return () => { document.title = prev; };
  }, [title]);
}
