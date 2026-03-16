'use client';

import { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
  hoverable?: boolean;
  children: ReactNode;
}

export default function Card({
  selected = false,
  hoverable = false,
  children,
  className = '',
  ...rest
}: CardProps) {
  return (
    <div
      className={`
        rounded-xl border bg-zinc-900 p-5 transition-all duration-200
        ${selected
          ? 'border-emerald-500 shadow-lg shadow-emerald-500/5'
          : 'border-zinc-800'}
        ${hoverable && !selected
          ? 'hover:bg-zinc-800/80 hover:border-zinc-700 cursor-pointer'
          : ''}
        ${className}
      `}
      {...rest}
    >
      {children}
    </div>
  );
}
