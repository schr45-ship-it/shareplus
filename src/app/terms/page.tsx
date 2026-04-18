export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-white text-zinc-900" dir="rtl">
      <main className="mx-auto w-full max-w-3xl px-6 py-10 text-right">
        <h1 className="text-2xl font-semibold">תנאי שימוש</h1>
        <div className="mt-2 text-xs text-zinc-500">תאריך עדכון אחרון: 18 באפריל 2026</div>

        <div className="mt-6 space-y-4 text-sm text-zinc-700">
          <p>
            תנאי השימוש עשויים להתעדכן ולהשתנות מעת לעת לפי שיקול דעתנו. המשך שימוש בשירות לאחר עדכון
            התנאים מהווה הסכמה לתנאים המעודכנים.
          </p>
          <p>
            לא הצלחתי לגשת לתוכן המלא של המסמך ששלחת (Google Docs דורש הרשאה/Publish). ברגע שתשלח כאן את
            הטקסט או תפרסם את המסמך ל-Web, אטמיע כאן את ההסכם המלא אחד-לאחד.
          </p>
        </div>
      </main>
    </div>
  );
}
