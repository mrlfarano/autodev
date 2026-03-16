'use client';

import { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({
  label,
  error,
  className = '',
  id,
  ...rest
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-zinc-400"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full bg-zinc-800 border border-zinc-700 rounded-lg
          px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500
          outline-none transition-all duration-150
          focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/40' : ''}
          ${className}
        `}
        {...rest}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
