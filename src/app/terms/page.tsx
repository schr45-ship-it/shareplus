export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-white text-zinc-900" dir="rtl">
      <main className="mx-auto w-full max-w-3xl px-6 py-10 text-right">
        <h1 className="text-2xl font-semibold">תנאי שימוש</h1>
        <div className="mt-2 text-xs text-zinc-500">תאריך עדכון אחרון: 18 באפריל 2026</div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
          <iframe
            title="תנאי שימוש - SharePlus"
            src="https://docs.google.com/document/d/e/2PACX-1vQOf7rxAk6A5bQ3IhN89FgUfO1q_VO_2Tzj3g1rJfqCAd70fZ4dyR2jTTyhlqicwqgqcafyVmChlacf/pub?embedded=true"
            className="h-[75dvh] w-full"
          />
        </div>
      </main>
    </div>
  );
}
