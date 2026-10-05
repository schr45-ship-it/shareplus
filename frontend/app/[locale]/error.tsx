"use client";

export default function LocaleError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="mb-3 text-2xl font-bold text-zinc-900">Something went wrong</h1>
      <p className="mb-6 text-zinc-500">Please try again in a moment.</p>
      <button
        onClick={reset}
        className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Try again
      </button>
    </div>
  );
}
