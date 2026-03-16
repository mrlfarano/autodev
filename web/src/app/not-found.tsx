import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">404</h1>
        <p className="text-zinc-400 mb-6">Page not found</p>
        <Link href="/" className="text-emerald-400 hover:text-emerald-300">
          Go home
        </Link>
      </div>
    </div>
  );
}
