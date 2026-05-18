'use client';

import { useEffect, useRef, useState } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const skipNextPersistRef = useRef(false);
  const [value, setValue] = useState<T>(() => {
    if (globalThis.window !== undefined) {
      try {
        const stored = globalThis.window.localStorage.getItem(key);
        if (stored === null) return initialValue;
        return JSON.parse(stored) as T;
      } catch {
        return initialValue;
      }
    }

    return initialValue;
  });

  useEffect(() => {
    if (globalThis.window === undefined) return;
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }

    try {
      globalThis.window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // quota exceeded or private mode — silently ignore
    }
  }, [key, value]);

  const remove = () => {
    if (globalThis.window !== undefined) {
      try {
        globalThis.window.localStorage.removeItem(key);
      } catch {
        // ignore
      }
    }

    skipNextPersistRef.current = true;
    setValue(initialValue);
  };

  return [value, setValue, remove] as const;
}
