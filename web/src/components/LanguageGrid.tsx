'use client';

const languages = [
  { name: 'Python', icon: '\uD83D\uDC0D', id: 'python' },
  { name: 'Rust', icon: '\uD83E\uDD80', id: 'rust' },
  { name: 'Go', icon: '\uD83D\uDC39', id: 'go' },
  { name: 'Java', icon: '\u2615', id: 'java' },
  { name: 'TypeScript', icon: '\uD83D\uDC8E', id: 'typescript' },
  { name: 'C#', icon: '\uD83C\uDFAF', id: 'csharp' },
  { name: 'Next.js', icon: '\u25B2', id: 'nextjs' },
  { name: 'Ruby', icon: '\uD83D\uDC8E', id: 'ruby' },
];

interface LanguageGridProps {
  selectable?: boolean;
  selected?: string;
  onSelect?: (id: string) => void;
}

export default function LanguageGrid({
  selectable = false,
  selected,
  onSelect,
}: LanguageGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 stagger">
      {languages.map((lang) => (
        <button
          key={lang.id}
          type="button"
          disabled={!selectable}
          onClick={() => selectable && onSelect?.(lang.id)}
          className={`
            animate-fade-in flex flex-col items-center gap-2 rounded-xl border
            p-4 transition-all duration-200
            ${
              selected === lang.id
                ? 'border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/5'
                : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800/50'
            }
            ${selectable ? 'cursor-pointer' : 'cursor-default'}
          `}
        >
          <span className="text-2xl">{lang.icon}</span>
          <span className="text-sm font-medium text-zinc-300">{lang.name}</span>
        </button>
      ))}
      <div className="animate-fade-in flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-800 p-4 text-zinc-600">
        <span className="text-2xl">+</span>
        <span className="text-sm">More coming...</span>
      </div>
    </div>
  );
}
