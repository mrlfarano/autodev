'use client';

import Link from 'next/link';
import Wizard from '@/components/Wizard';

export default function SetupPage() {
  return (
    <main className="min-h-screen py-8 px-6">
      {/* Header */}
      <div className="max-w-2xl mx-auto mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to home
        </Link>
        <h1 className="text-3xl font-bold">
          <span className="text-zinc-100">auto</span>
          <span className="text-emerald-400">dev</span>
          <span className="text-zinc-500 font-normal ml-3 text-lg">Setup</span>
        </h1>
      </div>

      <Wizard />
    </main>
  );
}
