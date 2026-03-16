'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export default function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
}: ToggleProps) {
  return (
    <label
      className={`
        inline-flex items-center gap-3 select-none
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-6 w-11 shrink-0 rounded-full
          transition-colors duration-200 ease-in-out
          focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2
          focus-visible:ring-offset-zinc-950
          ${checked ? 'bg-emerald-600' : 'bg-zinc-700'}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-5 w-5 rounded-full
            bg-white shadow-sm ring-0 transition-transform duration-200
            ease-in-out translate-y-0.5
            ${checked ? 'translate-x-5.5' : 'translate-x-0.5'}
          `}
        />
      </button>
      {label && <span className="text-sm text-zinc-300">{label}</span>}
    </label>
  );
}
