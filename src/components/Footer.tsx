import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-zinc-100 bg-white" dir="rtl">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-6 py-4">
        <div className="text-xs text-zinc-500">© {new Date().getFullYear()} SharePlus</div>
        <nav className="flex items-center gap-4 text-xs">
          <Link className="text-zinc-600 hover:underline" href="/about">
            אודות
          </Link>
          <Link className="text-zinc-600 hover:underline" href="/terms">
            תנאי שימוש
          </Link>
          <Link className="text-zinc-600 hover:underline" href="/accessibility">
            הצהרת נגישות
          </Link>
        </nav>
      </div>
    </footer>
  );
}
