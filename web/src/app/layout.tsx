import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'autodev — Autonomous App Development',
  description:
    'Point an AI at your codebase. Wake up to a better project. autodev loops, scores, and improves your code autonomously.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="bg-zinc-950 text-zinc-100 font-[var(--font-inter)] antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
