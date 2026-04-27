'use client';

import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          title: 'font-display font-bold',
          description: 'text-xs',
        },
      }}
    />
  );
}
