import type { Metadata } from 'next';
import { Noto_Sans_Thai } from 'next/font/google';
import type { ReactNode } from 'react';

import { Toaster } from '@/components/ui/sonner';
import './globals.css';

const notoSansThai = Noto_Sans_Thai({
  subsets: ['latin', 'thai'],
  variable: '--font-notoSansThai',
});

export const metadata: Metadata = {
  title: 'Badminton Matcher',
  description: 'Fair, Fast, Fun badminton matcher',
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="th">
      <body className={`${notoSansThai.variable} font-sans`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
